import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AmbientBackground } from "../../components/AmbientBackground";
import { DjCard } from "../../components/DjCard";
import { EmptyState } from "../../components/EmptyState";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type { Dj } from "../../lib/api/types";

export default function BrowseScreen() {
  const api = useApi();
  const [query, setQuery] = useState("");

  const { data } = useQuery({
    queryKey: queryKeys.djs.search(query),
    queryFn: () => api.get<Dj[]>("/djs/search", { q: query }),
    enabled: query.length > 0,
  });

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink">
      <AmbientBackground />
      <ScreenHeader title="Browse DJs">
        <TextInput
          placeholder="Search DJs..."
          value={query}
          onChangeText={setQuery}
          className="rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary px-4 py-3 text-ink dark:text-paper placeholder:text-muted"
        />
      </ScreenHeader>
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <DjCard dj={item} />}
        ListEmptyComponent={
          query.length > 0 ? (
            <EmptyState message="No DJs found. Add one when you log a set." />
          ) : (
            <EmptyState message="Search for a DJ to see their profile and reviews." />
          )
        }
      />
    </SafeAreaView>
  );
}
