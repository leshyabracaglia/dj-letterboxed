import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, View } from "react-native";

import { DetailPage } from "@/components/DetailPage";
import { ListFormSheet } from "@/components/ListFormSheet";
import { ReviewCard } from "@/components/ReviewCard";
import {
  EmptyState,
  FadeInView,
  FitText,
  Skeleton,
  Text,
  TornCardSeparator,
  usePageContentStyle,
} from "@/components/ui";
import { errorMessage, unwrap, useApi } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/queryKeys";
import type { ListDetail } from "@/lib/api/types";
import { useCurrentUser } from "@/lib/auth";
import { confirmDestructive, showAlert } from "@/lib/dialog";
import { plural } from "@/lib/format";
import { ROUTES } from "@/lib/routes";

function ListSkeleton() {
  const contentStyle = usePageContentStyle("roomy");
  return (
    <View style={contentStyle}>
      <Skeleton className="h-12 w-64" />
      <Skeleton className="mt-2 h-4 w-40" />
      <Skeleton className="mt-6 h-48 w-full rounded-none" />
    </View>
  );
}

// A curated list: its title and who made it, then its nights and sets in
// order, each with the maker's note. Its maker can rename it, take things
// off and delete it.
export default function ListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const query = useQuery({
    queryKey: queryKeys.lists.byId(id ?? ""),
    queryFn: () => unwrap(api.GET("/api/lists/{id}", { params: { path: { id: id! } } })),
    enabled: !!id,
  });

  return (
    <DetailPage
      underHeader
      query={query}
      title={(data) => data.title}
      skeleton={<ListSkeleton />}
      missing="This list isn't on Beatboxd."
    >
      {(data) => <ListBody list={data} />}
    </DetailPage>
  );
}

function ListBody({ list }: { list: ListDetail }) {
  const contentStyle = usePageContentStyle("roomy");
  const api = useApi();
  const queryClient = useQueryClient();
  const { me } = useCurrentUser();
  const isOwner = me?.id === list.userId;
  const [editing, setEditing] = useState(false);

  const removeItem = useMutation({
    mutationFn: (itemId: string) =>
      unwrap(api.DELETE("/api/lists/{id}/items/{itemId}", { params: { path: { id: list.id, itemId } } })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["lists"] }),
    onError: (err) => showAlert("Couldn't remove that", errorMessage(err, "Try again in a moment.")),
  });
  const deleteList = async () => {
    const confirmed = await confirmDestructive({
      title: "Delete this list?",
      message: "The nights on it stay; only the list goes.",
    });
    if (!confirmed) return;
    try {
      await unwrap(api.DELETE("/api/lists/{id}", { params: { path: { id: list.id } } }));
      void queryClient.invalidateQueries({ queryKey: ["lists"] });
      router.back();
    } catch (err) {
      showAlert("Couldn't delete the list", errorMessage(err, "Try again in a moment."));
    }
  };

  return (
    <>
      <FlatList
        contentContainerStyle={contentStyle}
        data={list.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const set = item.djId ? item.review.lineup.find((entry) => entry.dj.id === item.djId) : undefined;
          return (
            <FadeInView index={index} className="gap-3">
              <View className="flex-row items-end justify-between gap-3">
                <Text variant="display" className="flex-1 text-xl text-paper/80">
                  {index + 1}. {set ? `${set.dj.name}'s set` : "The whole night"}
                </Text>
                {isOwner && (
                  <Pressable
                    onPress={() => removeItem.mutate(item.id)}
                    disabled={removeItem.isPending}
                    hitSlop={8}
                    accessibilityRole="button"
                  >
                    <Text variant="display" className="text-base text-paper/60 underline">
                      Remove
                    </Text>
                  </Pressable>
                )}
              </View>
              {!!item.note && <Text className="text-base italic leading-6 text-paper">“{item.note}”</Text>}
              <ReviewCard review={item.review} index={index} />
            </FadeInView>
          );
        }}
        ItemSeparatorComponent={TornCardSeparator}
        ListHeaderComponent={
          <View>
            <FadeInView>
              <Text variant="display" className="text-lg text-zine-red-ink">
                List · {plural(list.items.length, "entry", "entries")}
              </Text>
              <FitText fontSize={56} numberOfLines={3} className="text-paper">
                {list.title}
              </FitText>
              <Link href={ROUTES.USER(list.user.username)}>
                <Text variant="display" className="text-lg text-paper/70 underline">
                  by @{list.user.username}
                </Text>
              </Link>
              {!!list.description && <Text className="mt-3 text-base leading-6 text-paper">{list.description}</Text>}
              {isOwner && (
                <View className="mt-3 flex-row gap-5">
                  <Pressable onPress={() => setEditing(true)} hitSlop={8} accessibilityRole="button">
                    <Text variant="display" className="text-base text-paper underline">
                      Edit
                    </Text>
                  </Pressable>
                  <Pressable onPress={deleteList} hitSlop={8} accessibilityRole="button">
                    <Text variant="display" className="text-base text-danger-dark underline">
                      Delete list
                    </Text>
                  </Pressable>
                </View>
              )}
            </FadeInView>
            <View className="h-6" />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            message={
              isOwner ? "Nothing on it yet. Open any night and tap “Add to a list”." : "Nothing on this list yet."
            }
          />
        }
      />
      {editing && (
        <ListFormSheet
          list={list}
          onSaved={() => {
            setEditing(false);
            void queryClient.invalidateQueries({ queryKey: queryKeys.lists.byId(list.id) });
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
