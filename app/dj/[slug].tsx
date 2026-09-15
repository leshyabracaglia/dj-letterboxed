import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { FlatList, SafeAreaView, Text, View } from "react-native";

import { LogCard } from "../../components/LogCard";
import { RatingStars } from "../../components/RatingStars";
import { useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type { DjDetail } from "../../lib/api/types";

export default function DjProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const api = useApi();
  const { data } = useQuery({
    queryKey: queryKeys.djs.bySlug(slug!),
    queryFn: () => api.get<DjDetail>(`/api/djs/${slug}`),
  });

  if (!data) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <Text className="text-muted">Loading...</Text>
      </SafeAreaView>
    );
  }

  // avgRating is the average of `ratingHalfStars` (1-10 units); divide by 2 for a 0.5-5.0 star display.
  const avgHalfStars = data.avgRating ? Number(data.avgRating) : null;

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Stack.Screen options={{ title: data.dj.name }} />
      <View className="border-b border-muted/20 px-4 py-4">
        <Text className="text-2xl font-bold text-ink">{data.dj.name}</Text>
        {data.dj.genres && data.dj.genres.length > 0 ? (
          <Text className="mt-1 text-muted">{data.dj.genres.join(" · ")}</Text>
        ) : null}
        <View className="mt-2 flex-row items-center gap-2">
          <RatingStars value={avgHalfStars} />
          <Text className="text-muted">
            {avgHalfStars ? (avgHalfStars / 2).toFixed(1) : "—"} ({data.logCount} logs)
          </Text>
        </View>
        {data.dj.bio ? <Text className="mt-3 text-ink">{data.dj.bio}</Text> : null}
      </View>
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={data.recentLogs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <LogCard log={item} />}
        ListEmptyComponent={
          <Text className="mt-10 text-center text-muted">No logs yet for this DJ.</Text>
        }
      />
    </SafeAreaView>
  );
}
