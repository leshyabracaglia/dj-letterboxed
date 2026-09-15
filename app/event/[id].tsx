import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { FlatList, SafeAreaView, Text, View } from "react-native";

import { LogCard } from "../../components/LogCard";
import { useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type { EventDetail } from "../../lib/api/types";

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const { data } = useQuery({
    queryKey: queryKeys.events.byId(id!),
    queryFn: () => api.get<EventDetail>(`/api/events/${id}`),
  });

  if (!data) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <Text className="text-muted">Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Stack.Screen options={{ title: data.event.name }} />
      <View className="border-b border-muted/20 px-4 py-4">
        <Text className="text-2xl font-bold text-ink">{data.event.name}</Text>
        <Text className="mt-1 text-muted">
          {data.event.venue}
          {data.event.city ? ` · ${data.event.city}` : ""}
        </Text>
        <Text className="mt-1 text-xs text-muted">
          {new Date(data.event.eventDate).toLocaleString()}
        </Text>
        {data.event.description ? (
          <Text className="mt-3 text-ink">{data.event.description}</Text>
        ) : null}
      </View>
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={data.logs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <LogCard log={item} />}
        ListEmptyComponent={
          <Text className="mt-10 text-center text-muted">
            No logs yet for this event.
          </Text>
        }
      />
    </SafeAreaView>
  );
}
