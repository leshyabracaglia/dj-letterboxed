import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Link, router, Stack } from "expo-router";
import { useEffect, useRef } from "react";
import { FlatList, Pressable, View } from "react-native";

import { Avatar, Icon, type IconName, Page, RowSeparator, Skeleton, Text, usePageContentStyle } from "@/components/ui";
import { useApi, unwrap } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/queryKeys";
import type { Notification, UnreadNotificationsResponse } from "@/lib/api/types";
import { useCurrentUser } from "@/lib/auth";
import { formatTimeAgo } from "@/lib/format";
import { ROUTES } from "@/lib/routes";

export default function NotificationsScreen() {
  const api = useApi();
  const queryClient = useQueryClient();
  const contentStyle = usePageContentStyle();
  const { isSignedIn } = useCurrentUser();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      unwrap(api.GET("/api/notifications", { params: { query: { cursor: pageParam, limit: 30 } } })),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!isSignedIn,
  });
  const items = withSections(data?.pages.flatMap((page) => page.items) ?? []);

  // Opening the list reads everything in it. The rows fetched before this
  // keep their unread highlight until the list is next fetched.
  const markedSeen = useRef(false);
  useEffect(() => {
    if (!data || markedSeen.current) return;
    markedSeen.current = true;
    unwrap(api.POST("/api/notifications/seen"))
      .then(() =>
        queryClient.setQueryData<UnreadNotificationsResponse>(queryKeys.notifications.unreadCount(), { count: 0 }),
      )
      .catch(() => {});
  }, [data, api, queryClient]);

  return (
    <Page underHeader>
      <Stack.Screen options={{ title: "Notifications" }} />
      <FlatList
        contentContainerStyle={[contentStyle, { paddingTop: 12 }]}
        data={items}
        keyExtractor={(item) => (item.kind === "section" ? `section-${item.label}` : item.notification.id)}
        renderItem={({ item, index }) =>
          item.kind === "section" ? (
            <SectionLabel label={item.label} first={!index} />
          ) : (
            <NotificationRow notification={item.notification} />
          )
        }
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
          ) : undefined
        }
        ListEmptyComponent={
          isSignedIn && isLoading ? (
            <NotificationSkeleton count={6} />
          ) : (
            <View className="mt-10 items-center gap-2 border border-dashed border-white/20 px-6 py-8">
              <Icon name="notifications-outline" size={28} className="text-paper/50" />
              <Text variant="display" className="text-2xl text-paper">
                Nothing yet
              </Text>
              <Text className="text-center text-sm text-paper/60">
                Follows, likes, comments, tags and IDs people name will show up here.
              </Text>
            </View>
          )
        }
      />
    </Page>
  );
}

type ListItem = { kind: "section"; label: string } | { kind: "notification"; notification: Notification };

// Unread notifications under "New", the rest under "Earlier" (no headings
// when they're all one or the other).
function withSections(notifications: Notification[]): ListItem[] {
  const unread = notifications.filter((n) => n.isUnread);
  const read = notifications.filter((n) => !n.isUnread);
  const rows = (list: Notification[]): ListItem[] =>
    list.map((notification) => ({ kind: "notification", notification }));
  if (!unread.length || !read.length) return rows(notifications);
  return [{ kind: "section", label: "New" }, ...rows(unread), { kind: "section", label: "Earlier" }, ...rows(read)];
}

function SectionLabel({ label, first }: { label: string; first: boolean }) {
  return (
    <Text variant="display" className={`text-xl text-paper/70 ${first ? "" : "mt-4"}`}>
      {label}
    </Text>
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
    case "id_suggested":
      return `knows the ID on your night${of}`;
    case "id_accepted":
      return `says you got the ID${of} right`;
    case "here_too":
      return n.subject ? `is at ${n.subject} too` : "is here too";
  }
}

// The badge on the avatar: what happened, at a glance.
const TYPE_ICONS: Record<Notification["type"], IconName> = {
  follow: "person-add",
  like: "heart",
  comment: "chatbubble",
  tag: "people",
  id_suggested: "musical-notes",
  id_accepted: "checkmark",
  here_too: "location",
};

const AVATAR = 40;

function NotificationRow({ notification: n }: { notification: Notification }) {
  const href = n.reviewId ? ROUTES.REVIEW_DETAIL(n.reviewId) : ROUTES.USER(n.actor.username);
  return (
    <Link href={href} asChild>
      <Pressable
        className={`flex-row items-start gap-3 border-y border-r p-3 active:opacity-90 ${
          n.isUnread
            ? "border-l-4 border-y-white/10 border-l-zine-purple border-r-white/10 bg-zine-panel"
            : "border-l border-white/10 bg-zine-panel/80"
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
          <View className="overflow-hidden rounded-full" style={{ width: AVATAR, height: AVATAR }}>
            <Avatar uri={n.actor.avatarUrl} name={n.actor.username} size={AVATAR} />
          </View>
          <View className="absolute -bottom-1 -right-1 h-5 w-5 items-center justify-center rounded-full border-2 border-ink bg-zine-purple">
            <Icon name={TYPE_ICONS[n.type]} size={10} className="text-paper" />
          </View>
        </Pressable>
        <View className="flex-1 gap-1">
          <View className="flex-row items-start gap-2">
            <Text className="flex-1 text-[15px] leading-5 text-paper/85">
              <Text variant="display" className="text-lg leading-5 text-paper">
                {n.actor.username}
              </Text>{" "}
              {describe(n)}
            </Text>
            <Text className={`text-xs ${n.isUnread ? "text-primary-dark" : "text-paper/50"}`}>
              {formatTimeAgo(n.createdAt)}
            </Text>
          </View>
          {!!n.commentBody && (
            <Text className="border-l-2 border-paper/25 pl-2 text-sm text-paper/70" numberOfLines={2}>
              {n.commentBody}
            </Text>
          )}
          {n.type === "tag" && !n.nightLogged && !!n.reviewId && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                router.push(ROUTES.REVIEW_FROM(n.reviewId!));
              }}
              className="mt-1 flex-row items-center gap-1.5 self-start bg-zine-purple px-3 py-1.5 active:opacity-80"
            >
              <Icon name="add" size={14} className="text-paper" />
              <Text variant="display" className="text-base leading-5 text-paper">
                Log this night too
              </Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    </Link>
  );
}

function NotificationSkeleton({ count }: { count: number }) {
  return (
    <View className="gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} className="flex-row items-center gap-3 border border-white/10 bg-zine-panel/80 p-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <View className="flex-1">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="mt-1.5 h-3 w-12" />
          </View>
        </View>
      ))}
    </View>
  );
}
