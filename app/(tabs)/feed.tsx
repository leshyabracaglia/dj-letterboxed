import { useAuth } from "@clerk/expo";
import { useState } from "react";
import { FlatList, Pressable, View } from "react-native";

import { EmptyState, Page, Text, usePageContentStyle } from "../../components/ui";
import { ReviewCard } from "../../components/ReviewCard";
import { useFeed, usePopularFeed } from "../../lib/api/hooks";

const FEED_TABS = {
  FOLLOWING: "following",
  POPULAR: "popular",
} as const;

type IFeedTab = (typeof FEED_TABS)[keyof typeof FEED_TABS];

const FEED_TAB_LABELS: Record<IFeedTab, string> = {
  [FEED_TABS.FOLLOWING]: "Following",
  [FEED_TABS.POPULAR]: "Popular",
};

export default function FeedScreen() {
  const { isSignedIn } = useAuth();
  const [tab, setTab] = useState<IFeedTab>(FEED_TABS.FOLLOWING);
  const contentStyle = usePageContentStyle();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useFeed(
    !!isSignedIn,
  );

  const pages = data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const followingCount = pages[0]?.followingCount ?? 0;
  const noFollowing = !isSignedIn || (!isLoading && followingCount === 0);
  const effectiveTab: IFeedTab = !isSignedIn
    ? FEED_TABS.POPULAR
    : tab === FEED_TABS.FOLLOWING && noFollowing
      ? FEED_TABS.POPULAR
      : tab;

  const { data: popularData, isLoading: isPopularLoading } = usePopularFeed(
    effectiveTab === FEED_TABS.POPULAR,
  );

  return (
    <Page
      ambient
      title="Feed"
      header={
        isSignedIn ? (
          <View className="flex-row gap-2">
            {Object.values(FEED_TABS).map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                className={`rounded-full px-3 py-1.5 active:opacity-80 ${
                  effectiveTab === t ? "bg-primary" : "bg-white dark:bg-surface-dark border border-primary/20"
                }`}
              >
                <Text className={effectiveTab === t ? "text-paper" : "text-ink dark:text-paper"}>
                  {FEED_TAB_LABELS[t]}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null
      }
    >
      {effectiveTab === "popular" ? (
        <FlatList
          contentContainerStyle={contentStyle}
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
      ) : (
        <FlatList
          contentContainerStyle={contentStyle}
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
    </Page>
  );
}
