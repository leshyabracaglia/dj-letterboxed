import { Stack, useLocalSearchParams } from "expo-router";
import { FlatList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../components/Text";

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
    <SafeAreaView className="flex-1 bg-paper dark:bg-ink">
      <Stack.Screen options={{ title: data.event.name }} />
      <View className="border-b border-accent/15 px-4 pb-4 pt-6">
        <Text className="text-2xl font-bold text-ink dark:text-paper">{data.event.name}</Text>
        <Text className="mt-1 text-muted">
          {data.event.venue}
          {data.event.city ? ` · ${data.event.city}` : ""}
        </Text>
        <Text className="mt-1 text-xs text-muted">{formatDateTime(data.event.eventDate)}</Text>
        {data.event.description ? (
          <Text className="mt-3 text-ink dark:text-paper">{data.event.description}</Text>
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
