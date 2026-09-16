import { useAuth } from "@clerk/expo";
import { useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../components/Text";

import { AmbientBackground } from "../../components/AmbientBackground";
import { EmptyState } from "../../components/EmptyState";
import { ReviewCard } from "../../components/ReviewCard";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useFeed, useLeaderboard, usePopularFeed } from "../../lib/api/hooks";

const TABS = ["following", "popular", "leaderboard"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = {
  following: "Following",
  popular: "Popular",
  leaderboard: "Leaderboard",
};

export default function FeedScreen() {
  const { isSignedIn } = useAuth();
  const [tab, setTab] = useState<Tab>("following");

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useFeed(
    !!isSignedIn,
  );

  const pages = data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const followingCount = pages[0]?.followingCount ?? 0;
  const noFollowing = !isSignedIn || (!isLoading && followingCount === 0);
  const effectiveTab: Tab = !isSignedIn
    ? "popular"
    : tab === "following" && noFollowing
      ? "popular"
      : tab;

  const { data: popularData, isLoading: isPopularLoading } = usePopularFeed(
    effectiveTab === "popular",
  );

  const { data: leaderboard, isLoading: isLeaderboardLoading } = useLeaderboard(
    !!isSignedIn && effectiveTab === "leaderboard",
  );

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink">
      <AmbientBackground />
      <ScreenHeader title="Feed">
        {isSignedIn ? (
          <View className="flex-row gap-2">
            {TABS.map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                className={`rounded-full px-3 py-1.5 active:opacity-80 ${
                  effectiveTab === t ? "bg-primary" : "bg-white dark:bg-surface-dark border border-primary/20"
                }`}
              >
                <Text className={effectiveTab === t ? "text-paper" : "text-ink dark:text-paper"}>
                  {TAB_LABELS[t]}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScreenHeader>

      {effectiveTab === "popular" ? (
        <FlatList
          contentContainerStyle={{ padding: 16 }}
          data={popularData?.items ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ReviewCard log={item} />}
          ListHeaderComponent={
            noFollowing ? (
              <Text className="mb-4 text-center text-muted">
                {isSignedIn
                  ? "Follow some people to see their logs here."
                  : "Sign up to follow people and see their logs here."}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            !isPopularLoading ? (
              <EmptyState
                message="No reviews yet — be the first to log a set."
                className="mt-4 text-center text-muted"
              />
            ) : null
          }
        />
      ) : effectiveTab === "leaderboard" ? (
        <FlatList
          contentContainerStyle={{ padding: 16 }}
          data={leaderboard ?? []}
          keyExtractor={(row) => row.user.id}
          renderItem={({ item, index }) => {
            const rankBg =
              index === 0 ? "bg-accent" : index === 1 ? "bg-primary" : "bg-muted/15";
            const rankText = index < 2 ? "text-white" : "text-muted";
            return (
              <View className="mb-2 flex-row items-center justify-between rounded-2xl border border-primary/15 bg-white dark:bg-surface-dark p-4 shadow-sm">
                <View className="flex-row items-center gap-3">
                  <View className={`h-7 w-7 items-center justify-center rounded-full ${rankBg}`}>
                    <Text className={`font-bold ${rankText}`}>{index + 1}</Text>
                  </View>
                  <Text className="text-ink dark:text-paper">
                    {item.user.displayName ?? item.user.username}
                  </Text>
                </View>
                <Text className="text-muted">{item.logCount} shows</Text>
              </View>
            );
          }}
          ListEmptyComponent={
            !isLeaderboardLoading ? (
              <EmptyState message="Follow some people to see a leaderboard." />
            ) : null
          }
        />
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16 }}
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ReviewCard log={item} />}
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
              <EmptyState message="Follow some people to see their logs here." />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
