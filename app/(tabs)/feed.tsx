import { useAuth } from "@clerk/expo";
import { useState } from "react";
import { FlatList, Pressable, View } from "react-native";

import {
  EmptyState,
  Page,
  PageHeader,
  Text,
  useIsDesktopWeb,
  usePageContentStyle,
} from "../../components/ui";
import { BrandWordmark } from "../../components/BrandWordmark";
import { ReviewCard, ReviewCardSkeleton } from "../../components/ReviewCard";
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
  const isDesktopWeb = useIsDesktopWeb();

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

  // With nobody followed there's only Popular to show, so the switcher is
  // hidden entirely (also while loading, so it doesn't flash in and out).
  const showTabs = !!isSignedIn && !isLoading && !!followingCount;
  const tabs = showTabs && (
    <View className="flex-row gap-2">
      {Object.values(FEED_TABS).map((t) => (
        <Pressable
          key={t}
          onPress={() => setTab(t)}
          accessibilityState={{ selected: effectiveTab === t }}
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
  );

  return (
    // Desktop web already shows the BeatBox'd wordmark in its top navbar;
    // phone widths have no navbar, so the wordmark heads the feed instead
    // (the bottom tab bar already says "Feed").
    <Page ambient title={isDesktopWeb ? "Feed" : undefined} header={tabs}>
      {!isDesktopWeb && (
        <PageHeader>
          <BrandWordmark className="mb-3" />
          {tabs}
        </PageHeader>
      )}
      {effectiveTab === FEED_TABS.POPULAR ? (
        <FlatList
          contentContainerStyle={contentStyle}
          data={popularData?.items ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ReviewCard review={item} />}
          ListHeaderComponent={
            noFollowing ? (
              <Text className="mb-4 text-center text-muted">
                {isSignedIn
                  ? "Follow some people to see their reviews here."
                  : "Sign up to follow people and see their reviews here."}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            isPopularLoading ? (
              <ReviewCardSkeleton count={4} />
            ) : (
              <EmptyState
                message="No reviews yet — be the first to review a set."
                className="mt-4 text-center text-muted"
              />
            )
          }
        />
      ) : (
        <FlatList
          contentContainerStyle={contentStyle}
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ReviewCard review={item} />}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          ListFooterComponent={
            isFetchingNextPage ? <ReviewCardSkeleton count={2} /> : null
          }
          ListEmptyComponent={
            isLoading ? (
              <ReviewCardSkeleton count={4} />
            ) : (
              <EmptyState message="Follow some people to see their reviews here." />
            )
          }
        />
      )}
    </Page>
  );
}
