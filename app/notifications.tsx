import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Link, router, Stack } from "expo-router";
import { useEffect, useRef } from "react";
import { FlatList, Pressable, View } from "react-native";

import { Avatar, EmptyState, Page, RowSeparator, Skeleton, Text, usePageContentStyle } from "../components/ui";
import { useApi } from "../lib/api/client";
import { queryKeys } from "../lib/api/queryKeys";
import type { Notification, NotificationsResponse, UnreadNotificationsResponse } from "../lib/api/types";
import { useCurrentUser } from "../lib/auth";
import { formatTimeAgo } from "../lib/format";
import { ROUTES } from "../lib/routes";

export default function NotificationsScreen() {
  const api = useApi();
  const queryClient = useQueryClient();
  const contentStyle = usePageContentStyle("roomy");
  const { isSignedIn } = useCurrentUser();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      api.get<NotificationsResponse>("/notifications", { cursor: pageParam, limit: 30 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!isSignedIn,
  });
  const items = data?.pages.flatMap((page) => page.items) ?? [];

  // Opening the list reads everything in it. The rows fetched before this
  // keep their unread highlight until the list is next fetched.
  const markedSeen = useRef(false);
  useEffect(() => {
    if (!data || markedSeen.current) return;
    markedSeen.current = true;
    api
      .post("/notifications/seen")
      .then(() =>
        queryClient.setQueryData<UnreadNotificationsResponse>(queryKeys.notifications.unreadCount(), { count: 0 }),
      )
      .catch(() => {});
  }, [data, api, queryClient]);

  return (
    <Page>
      <Stack.Screen options={{ title: "Notifications" }} />
      <FlatList
        contentContainerStyle={contentStyle}
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <NotificationRow notification={item} />}
        ItemSeparatorComponent={RowSeparator}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        ListFooterComponent={
          isFetchingNextPage ? (
            <>
              <View className="mt-2" />
              <NotificationSkeleton count={2} />
            </>
          ) : null
        }
        ListEmptyComponent={
          isSignedIn && isLoading ? (
            <NotificationSkeleton count={6} />
          ) : (
            <View className="mt-10">
              <EmptyState message="Nothing yet. Follows, likes, comments and tags will show up here." />
            </View>
          )
        }
      />
    </Page>
  );
}

function describe(n: Notification): string {
  const of = n.subject ? ` of ${n.subject}` : "";
  switch (n.type) {
    case "follow":
      return "started following you";
    case "like":
      return `liked your review${of}`;
    case "comment":
      return `commented on your review${of}`;
    case "tag":
      return n.subject ? `tagged you at ${n.subject}` : "tagged you in their night out";
  }
}

function NotificationRow({ notification: n }: { notification: Notification }) {
  const href = n.reviewId ? ROUTES.REVIEW_DETAIL(n.reviewId) : ROUTES.USER(n.actor.username);
  return (
    <Link href={href} asChild>
      <Pressable
        className={`flex-row items-start gap-3 border p-4 shadow-sm active:opacity-90 ${
          n.isUnread ? "border-accent/60 bg-zine-panel" : "border-white/10 bg-zine-panel/90"
        }`}
      >
        <Pressable
          hitSlop={4}
          className="active:opacity-80"
          onPress={(e) => {
            e.stopPropagation();
            router.push(ROUTES.USER(n.actor.username));
          }}
        >
          <Avatar uri={n.actor.avatarUrl} name={n.actor.username} size={40} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-base leading-6 text-paper">
            <Text className="font-semibold">@{n.actor.username}</Text> {describe(n)}
          </Text>
          {!!n.commentBody && (
            <Text className="mt-1 text-paper/70" numberOfLines={2}>
              “{n.commentBody}”
            </Text>
          )}
          <Text className="mt-1 text-xs text-paper/50">{formatTimeAgo(n.createdAt)}</Text>
          {n.type === "tag" && !n.nightLogged && !!n.reviewId && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                router.push(ROUTES.REVIEW_FROM(n.reviewId!));
              }}
              className="mt-2 self-start rounded-xl bg-accent px-3 py-1.5 active:opacity-80"
            >
              <Text className="font-display text-lg uppercase leading-5 text-paper">Log it too</Text>
            </Pressable>
          )}
        </View>
        {n.isUnread && <View className="mt-2 h-2.5 w-2.5 rounded-full bg-accent" />}
      </Pressable>
    </Link>
  );
}

function NotificationSkeleton({ count }: { count: number }) {
  return (
    <View className="gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} className="flex-row items-center gap-3 border border-white/10 bg-zine-panel/90 p-4 shadow-sm">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <View className="flex-1">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="mt-1.5 h-3 w-12" />
          </View>
        </View>
      ))}
    </View>
  );
}
