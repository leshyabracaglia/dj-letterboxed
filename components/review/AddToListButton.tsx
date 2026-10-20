import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";

import { FieldLabel, INPUT_CLASS, SheetRow } from "@/components/log/fields";
import { ListFormSheet } from "@/components/ListFormSheet";
import { Icon, KEYBOARD_DISMISS_PROPS, Sheet, Text } from "@/components/ui";
import { errorMessage, unwrap, useApi } from "@/lib/api/client";
import { useUserLists } from "@/lib/api/hooks";
import type { Review } from "@/lib/api/types";
import { useCurrentUser } from "@/lib/auth";
import { showAlert } from "@/lib/dialog";
import { plural } from "@/lib/format";
import { ROUTES } from "@/lib/routes";

/** "Add to a list" under a night: put it, or one DJ's set on it, on one of
 * your lists (or a new one), with a note. */
export function AddToListButton({ review }: { review: Review }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        className="flex-row items-center justify-center gap-2 self-center border border-dashed border-paper/60 px-4 py-2 active:opacity-70"
      >
        <Icon name="list" size={16} className="text-paper" />
        <Text variant="display" className="text-lg leading-5 text-paper">
          Add to a list
        </Text>
      </Pressable>
      {open && <AddToListSheet review={review} onClose={() => setOpen(false)} />}
    </>
  );
}

function AddToListSheet({ review, onClose }: { review: Review; onClose: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { me } = useCurrentUser();
  const { data: lists, isLoading } = useUserLists(me?.username, review.id);
  // Which set: a DJ's id, or null for the whole night.
  const [djId, setDjId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);

  const add = useMutation({
    mutationFn: (listId: string) =>
      unwrap(
        api.POST("/api/lists/{id}/items", {
          params: { path: { id: listId } },
          body: { reviewId: review.id, djId: djId ?? undefined, note: note.trim() || undefined },
        }),
      ),
    onSuccess: (_, listId) => {
      void queryClient.invalidateQueries({ queryKey: ["lists"] });
      onClose();
      router.push(ROUTES.LIST(listId));
    },
    onError: (err) => showAlert("Couldn't add it", errorMessage(err, "Try again in a moment.")),
  });

  if (creating) {
    return <ListFormSheet onSaved={(list) => add.mutate(list.id)} onClose={() => setCreating(false)} />;
  }

  return (
    <Sheet title="Add to a list" onClose={onClose}>
      <ScrollView className="shrink" {...KEYBOARD_DISMISS_PROPS}>
        <View className="gap-3 px-4 pb-3">
          {!!review.lineup.length && (
            <View className="gap-2">
              <FieldLabel>What goes on it</FieldLabel>
              <View className="flex-row flex-wrap gap-2">
                <Choice label="The whole night" selected={djId === null} onPress={() => setDjId(null)} />
                {review.lineup.map(({ dj }) => (
                  <Choice
                    key={dj.id}
                    label={`${dj.name}'s set`}
                    selected={djId === dj.id}
                    onPress={() => setDjId(dj.id)}
                  />
                ))}
              </View>
            </View>
          )}
          <View className="gap-1">
            <FieldLabel>Why it&apos;s on there (optional)</FieldLabel>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="What made it one of these"
              maxLength={500}
              className={INPUT_CLASS}
            />
          </View>
          <FieldLabel>Your lists</FieldLabel>
        </View>
        {isLoading && <Text className="px-4 text-paper/60">Loading your lists…</Text>}
        {lists?.map((list) => (
          <SheetRow
            key={list.id}
            left={<Icon name={list.hasReview ? "checkmark-circle" : "list"} size={22} className="text-paper/80" />}
            title={list.title}
            subtitle={`${plural(list.itemCount, "entry", "entries")}${list.hasReview ? " · this night's on it" : ""}`}
            onPress={() => add.mutate(list.id)}
          />
        ))}
        <SheetRow
          left={<Icon name="add" size={22} className="text-paper/80" />}
          title="New list"
          plain
          onPress={() => setCreating(true)}
        />
      </ScrollView>
    </Sheet>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`border-2 px-3 py-1.5 active:opacity-80 ${selected ? "border-paper bg-zine-purple" : "border-paper/30"}`}
    >
      <Text variant="display" className={`text-base ${selected ? "text-paper" : "text-paper/70"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
