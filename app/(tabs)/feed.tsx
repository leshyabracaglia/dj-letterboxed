import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { FlatList, SafeAreaView, Text, View } from "react-native";

import { LogCard } from "../../components/LogCard";
import { useTRPC } from "../../hooks/trpc";

export default function FeedScreen() {
  const trpc = useTRPC();

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(
    trpc.feed.getActivity.infiniteQueryOptions(
      { limit: 20 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined },
    ),
  );

  const pages = data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const followingCount = pages[0]?.followingCount ?? 0;
  const showPopularSection = !isLoading && followingCount === 0;

  const { data: popularData, isLoading: isPopularLoading } = useQuery({
    ...trpc.feed.getPopular.queryOptions({ limit: 20 }),
    enabled: showPopularSection,
  });

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="px-4 pb-2 pt-4">
        <Text className="text-2xl font-bold text-ink">Feed</Text>
      </View>
      {showPopularSection ? (
        <FlatList
          contentContainerStyle={{ padding: 16 }}
          data={popularData?.items ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <LogCard log={item} />}
          ListHeaderComponent={
            <>
              <Text className="mb-4 text-center text-muted">
                Follow some people to see their logs here.
              </Text>
              <Text className="mb-2 text-lg font-semibold text-ink">
                Popular reviews
              </Text>
            </>
          }
          ListEmptyComponent={
            !isPopularLoading ? (
              <Text className="mt-4 text-center text-muted">
                No reviews yet — be the first to log a set.
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
