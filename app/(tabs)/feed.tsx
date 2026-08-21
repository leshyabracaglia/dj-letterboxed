import { useQuery } from "@tanstack/react-query";
import { FlatList, SafeAreaView, Text, View } from "react-native";

import { LogCard } from "../../components/LogCard";
import { useTRPC } from "../../hooks/trpc";

export default function FeedScreen() {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(
    trpc.feed.getActivity.queryOptions({}),
  );

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="px-4 pb-2 pt-4">
        <Text className="text-2xl font-bold text-ink">Feed</Text>
      </View>
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <LogCard log={item} />}
        ListEmptyComponent={
          !isLoading ? (
            <Text className="mt-10 text-center text-muted">
              Follow some people to see their logs here.
            </Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
