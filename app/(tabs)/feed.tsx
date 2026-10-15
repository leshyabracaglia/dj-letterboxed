import { useAuth } from "@clerk/expo";
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";

import {
  ChannelLabel,
  EmptyState,
  Page,
  PageHeader,
  SegmentedTabs,
  Text,
  TornCardSeparator,
  useIsDesktopWeb,
  usePageContentStyle,
} from "../../components/ui";
import { BrandWordmark } from "../../components/BrandWordmark";
import { NotificationsBell } from "../../components/NotificationsBell";
import { ReviewCard, ReviewCardSkeleton } from "../../components/ReviewCard";
import { useFeed, usePopularFeed } from "../../lib/api/hooks";

const FEED_TABS = {
  FOLLOWING: "following",
  POPULAR: "popular",
} as const;

type IFeedTab = (typeof FEED_TABS)[keyof typeof FEED_TABS];

function usePullToRefresh(refetch: () => Promise<unknown>) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  return <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#F6F6F9" colors={["#0B090A"]} />;
}

const FEED_TAB_OPTIONS: { value: IFeedTab; label: string }[] = [
  { value: FEED_TABS.FOLLOWING, label: "Following" },
  { value: FEED_TABS.POPULAR, label: "Popular" },
];

export default function FeedScreen() {
  const { isSignedIn } = useAuth();
  const [tab, setTab] = useState<IFeedTab>(FEED_TABS.FOLLOWING);
  const contentStyle = usePageContentStyle("roomy");
  const isDesktopWeb = useIsDesktopWeb();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useFeed(!!isSignedIn);

  const pages = data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const followingCount = pages[0]?.followingCount ?? 0;
  const noFollowing = !isSignedIn || (!isLoading && followingCount === 0);
  const effectiveTab: IFeedTab = !isSignedIn
    ? FEED_TABS.POPULAR
    : tab === FEED_TABS.FOLLOWING && noFollowing
      ? FEED_TABS.POPULAR
      : tab;

  const {
    data: popularData,
    isLoading: isPopularLoading,
    refetch: refetchPopular,
  } = usePopularFeed(effectiveTab === FEED_TABS.POPULAR);

  const followingRefresh = usePullToRefresh(refetch);
  // Popular is also what shows while you follow nobody, so a pull there
  // rechecks the Following feed too: once you've followed someone, it (and the
  // tab switcher) appears.
  const popularRefresh = usePullToRefresh(() => Promise.all([refetchPopular(), isSignedIn && refetch()]));

  // With nobody followed there's only Popular to show, so the switcher is
  // hidden entirely (also while loading, so it doesn't flash in and out).
  const showTabs = !!isSignedIn && !isLoading && !!followingCount;
  // The first card's paper clip pokes up above it, so it needs more room under
  // the tabs than under the plain header.
  const listStyle = showTabs ? [contentStyle, { paddingTop: 40 }] : contentStyle;
  const tabs = showTabs && <SegmentedTabs tabs={FEED_TAB_OPTIONS} value={effectiveTab} onChange={setTab} />;

  return (
    // Desktop web already shows the BeatBox'd wordmark in its top navbar;
    // phone widths have no navbar, so the wordmark heads the feed instead
    // (the bottom tab bar already says "Feed").
    <Page title={isDesktopWeb ? "Feed" : undefined} channel="CH 01 · Feed" header={tabs}>
      {!isDesktopWeb && (
        <PageHeader>
          <View className="flex-row items-center justify-between">
            <BrandWordmark dot />
            {isSignedIn ? <NotificationsBell /> : <ChannelLabel label="CH 01 · Feed" />}
          </View>
          {tabs}
        </PageHeader>
      )}
      {effectiveTab === FEED_TABS.POPULAR ? (
        <FlatList
          contentContainerStyle={listStyle}
          data={popularData?.items ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={popularRefresh}
          renderItem={({ item, index }) => <ReviewCard review={item} index={index} />}
          ItemSeparatorComponent={TornCardSeparator}
          ListHeaderComponent={
            noFollowing ? (
              <>
                <Text className="text-center text-paper/60">
                  {isSignedIn
                    ? "Follow some people to see their reviews here."
                    : "Sign up to follow people and see their reviews here."}
                </Text>
                {/* Clears the paper clip that pokes up above the first card. */}
                <View className="h-10" />
              </>
            ) : null
          }
          ListEmptyComponent={
            isPopularLoading ? (
              <ReviewCardSkeleton count={4} />
            ) : (
              <View className="mt-4">
                <EmptyState message="No reviews yet — be the first to review a set." />
              </View>
            )
          }
        />
      ) : (
        <FlatList
          contentContainerStyle={listStyle}
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={followingRefresh}
          renderItem={({ item, index }) => <ReviewCard review={item} index={index} />}
          ItemSeparatorComponent={TornCardSeparator}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          ListFooterComponent={
            isFetchingNextPage ? (
              <>
                <View className="mt-10" />
                <ReviewCardSkeleton count={2} />
              </>
            ) : null
          }
          ListEmptyComponent={
            isLoading ? (
              <ReviewCardSkeleton count={4} />
            ) : (
              <View className="mt-10">
                <EmptyState message="Follow some people to see their reviews here." />
              </View>
            )
          }
        />
      )}
    </Page>
  );
}
