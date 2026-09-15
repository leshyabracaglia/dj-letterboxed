import { Stack, useLocalSearchParams } from "expo-router";
import { FlatList, SafeAreaView, Text, View } from "react-native";

import { EmptyState } from "../../components/EmptyState";
import { ReviewCard } from "../../components/ReviewCard";
import { ScreenLoading } from "../../components/ScreenLoading";
import { useEventDetail } from "../../lib/api/hooks";
import { formatDateTime } from "../../lib/format";

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useEventDetail(id);

  if (!data) {
    return <ScreenLoading />;
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
        <Text className="mt-1 text-xs text-muted">{formatDateTime(data.event.eventDate)}</Text>
        {data.event.description ? (
          <Text className="mt-3 text-ink">{data.event.description}</Text>
        ) : null}
      </View>
      <FlatList
        contentContainerStyle={{ padding: 16 }}
        data={data.logs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReviewCard log={item} />}
        ListEmptyComponent={<EmptyState message="No logs yet for this event." />}
      />
    </SafeAreaView>
  );
}
