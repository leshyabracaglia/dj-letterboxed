import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, SafeAreaView, Text, View } from "react-native";

import { LogCard } from "../../components/LogCard";
import { useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type { FeedResponse, LeaderboardEntry, PopularResponse } from "../../lib/api/types";

const TABS = ["following", "popular", "leaderboard"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = {
  following: "Following",
  popular: "Popular",
  leaderboard: "Leaderboard",
};

export default function FeedScreen() {
  const api = useApi();
  const [tab, setTab] = useState<Tab>("following");

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.feed.activity(),
    queryFn: ({ pageParam }: { pageParam?: string }) =>
      api.get<FeedResponse>("/api/feed", { cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const pages = data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const followingCount = pages[0]?.followingCount ?? 0;
  const noFollowing = !isLoading && followingCount === 0;
  const effectiveTab: Tab = tab === "following" && noFollowing ? "popular" : tab;

  const { data: popularData, isLoading: isPopularLoading } = useQuery({
    queryKey: queryKeys.feed.popular(),
    queryFn: () => api.get<PopularResponse>("/api/feed/popular", { limit: 20 }),
    enabled: effectiveTab === "popular",
  });

  const { data: leaderboard, isLoading: isLeaderboardLoading } = useQuery({
    queryKey: queryKeys.users.leaderboard(),
    queryFn: () => api.get<LeaderboardEntry[]>("/api/leaderboard"),
    enabled: effectiveTab === "leaderboard",
  });

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="px-4 pb-2 pt-4">
        <Text className="mb-3 text-2xl font-bold text-ink">Feed</Text>
        <View className="flex-row gap-2">
          {TABS.map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              className={`rounded-full px-3 py-1.5 ${
                effectiveTab === t ? "bg-ink" : "bg-white border border-muted/30"
              }`}
            >
              <Text className={effectiveTab === t ? "text-paper" : "text-ink"}>
                {TAB_LABELS[t]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {effectiveTab === "popular" ? (
        <FlatList
          contentContainerStyle={{ padding: 16 }}
          data={popularData?.items ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <LogCard log={item} />}
          ListHeaderComponent={
            noFollowing ? (
              <Text className="mb-4 text-center text-muted">
                Follow some people to see their logs here.
              </Text>
            ) : null
          }
          ListEmptyComponent={
            !isPopularLoading ? (
              <Text className="mt-4 text-center text-muted">
                No reviews yet — be the first to log a set.
              </Text>
            ) : null
          }
        />
      ) : effectiveTab === "leaderboard" ? (
        <FlatList
          contentContainerStyle={{ padding: 16 }}
          data={leaderboard ?? []}
          keyExtractor={(row) => row.user.id}
          renderItem={({ item, index }) => (
            <View className="mb-2 flex-row items-center justify-between rounded-xl border border-muted/20 bg-white p-4">
              <View className="flex-row items-center gap-3">
                <Text className="w-6 text-center font-semibold text-muted">{index + 1}</Text>
                <Text className="text-ink">
                  {item.user.displayName ?? item.user.username}
                </Text>
              </View>
              <Text className="text-muted">{item.logCount} shows</Text>
            </View>
          )}
          ListEmptyComponent={
            !isLeaderboardLoading ? (
              <Text className="mt-10 text-center text-muted">
                Follow some people to see a leaderboard.
              </Text>
            ) : null
          }
        />
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16 }}
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <LogCard log={item} />}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          ListFooterComponent={
            isFetchingNextPage ? (
              <Text className="my-4 text-center text-muted">Loading more…</Text>
            ) : null
          }
          ListEmptyComponent={
            !isLoading ? (
              <Text className="mt-10 text-center text-muted">
                Follow some people to see their logs here.
              </Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
