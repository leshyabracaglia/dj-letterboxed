import { Stack, useLocalSearchParams } from "expo-router";
import { FlatList, View } from "react-native";

import {
  EmptyState,
  Page,
  PageHeader,
  Skeleton,
  Text,
  usePageContentStyle,
} from "../../components/ui";
import { ReviewCard, ReviewCardSkeleton } from "../../components/ReviewCard";
import { useEventDetail } from "../../lib/api/hooks";
import { formatDateTime } from "../../lib/format";

function EventSkeleton() {
  const contentStyle = usePageContentStyle();
  return (
    <Page>
      <PageHeader border="accent">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-2 h-4 w-40" />
        <Skeleton className="mt-2 h-3 w-28" />
      </PageHeader>
      <View style={contentStyle}>
        <ReviewCardSkeleton count={3} />
      </View>
    </Page>
  );
}

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useEventDetail(id);
  const contentStyle = usePageContentStyle();

  if (!data) {
    return <EventSkeleton />;
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
        data={data.reviews}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReviewCard review={item} />}
        ListEmptyComponent={<EmptyState message="No reviews yet for this event." />}
      />
    </Page>
  );
}
