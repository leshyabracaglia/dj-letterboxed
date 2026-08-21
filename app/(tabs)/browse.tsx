import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, SafeAreaView, Text, TextInput, View } from "react-native";

import { DjCard } from "../../components/DjCard";
import { useTRPC } from "../../hooks/trpc";

export default function BrowseScreen() {
  const trpc = useTRPC();
  const [query, setQuery] = useState("");

  const { data } = useQuery({
    ...trpc.djs.search.queryOptions({ query }),
    enabled: query.length > 0,
  });

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="px-4 pb-2 pt-4">
        <Text className="mb-3 text-2xl font-bold text-ink">Browse DJs</Text>
        <TextInput
          placeholder="Search DJs..."
          value={query}
          onChangeText={setQuery}
          className="rounded-lg border border-muted/30 bg-white px-4 py-3"
        />
      </View>
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <DjCard dj={item} />}
        ListEmptyComponent={
          query.length > 0 ? (
            <Text className="mt-10 text-center text-muted">
              No DJs found. Add one when you log a set.
            </Text>
          ) : (
            <Text className="mt-10 text-center text-muted">
              Search for a DJ to see their profile and reviews.
            </Text>
          )
        }
      />
    </SafeAreaView>
  );
}
