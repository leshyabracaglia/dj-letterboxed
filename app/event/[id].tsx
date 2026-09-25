import { Stack, useLocalSearchParams } from "expo-router";
import { FlatList } from "react-native";

import {
  EmptyState,
  Page,
  PageHeader,
  ScreenLoading,
  Text,
  usePageContentStyle,
} from "../../components/ui";
import { ReviewCard } from "../../components/ReviewCard";
import { useEventDetail } from "../../lib/api/hooks";
import { formatDateTime } from "../../lib/format";

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useEventDetail(id);
  const contentStyle = usePageContentStyle();

  if (!data) {
    return <ScreenLoading />;
  }

  return (
    <Page>
      <Stack.Screen options={{ title: data.event.name }} />
      <PageHeader border="accent">
        <Text className="text-2xl font-bold text-ink dark:text-paper">{data.event.name}</Text>
        <Text className="mt-1 text-muted">
          {data.event.venue}
          {data.event.city ? ` · ${data.event.city}` : ""}
        </Text>
        <Text className="mt-1 text-xs text-muted">{formatDateTime(data.event.eventDate)}</Text>
        {data.event.description ? (
          <Text className="mt-3 text-ink dark:text-paper">{data.event.description}</Text>
        ) : null}
      </PageHeader>
      <FlatList
        contentContainerStyle={contentStyle}
        data={data.logs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReviewCard log={item} />}
        ListEmptyComponent={<EmptyState message="No logs yet for this event." />}
      />
    </Page>
  );
}
