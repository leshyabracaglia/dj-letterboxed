import { Link, Stack, useLocalSearchParams } from "expo-router";
import { FlatList, View } from "react-native";

import {
  EmptyState,
  Page,
  PageHeader,
  Skeleton,
  Text,
  usePageContentStyle,
} from "../../components/ui";
import { useVenueDetail } from "../../lib/api/hooks";
import type { Event } from "../../lib/api/types";
import { formatDateTime } from "../../lib/format";
import { ROUTES } from "../../lib/routes";

function VenueEventRow({ event }: { event: Event }) {
  return (
    <Link href={ROUTES.EVENT(event.id)} asChild>
      <View className="mb-3 rounded-2xl border border-accent/15 bg-white p-4 dark:bg-surface-dark active:opacity-80">
        <Text className="text-base font-semibold text-ink dark:text-paper">{event.name}</Text>
        <Text className="mt-1 text-xs text-muted">{formatDateTime(event.eventDate)}</Text>
      </View>
    </Link>
  );
}

function VenueSkeleton() {
  const contentStyle = usePageContentStyle();
  return (
    <Page>
      <PageHeader border="accent">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-36" />
      </PageHeader>
      <View style={contentStyle}>
        {Array.from({ length: 4 }).map((_, i) => (
          <View
            key={i}
            className="mb-3 rounded-2xl border border-accent/15 bg-white p-4 dark:bg-surface-dark"
          >
            <Skeleton className="h-5 w-44" />
            <Skeleton className="mt-2 h-3 w-28" />
          </View>
        ))}
      </View>
    </Page>
  );
}

export default function VenueScreen() {
  // expo-router's LocationProvider already runs every param through
  // decodeURIComponent before it reaches here - don't decode again.
  const { venue } = useLocalSearchParams<{ venue: string }>();
  const { data } = useVenueDetail(venue);
  const contentStyle = usePageContentStyle();

  if (!data) {
    return <VenueSkeleton />;
  }

  return (
    <Page>
      <Stack.Screen options={{ title: data.venue }} />
      <PageHeader border="accent">
        <Text className="text-2xl font-bold text-ink dark:text-paper">{data.venue}</Text>
        <Text className="mt-1 text-muted">
          {data.city ? `${data.city} · ` : ""}
          {data.eventCount} {data.eventCount === 1 ? "event" : "events"} reviewed
        </Text>
      </PageHeader>
      <FlatList
        contentContainerStyle={contentStyle}
        data={data.events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <VenueEventRow event={item} />}
        ListEmptyComponent={<EmptyState message="No events reviewed at this venue yet." />}
      />
    </Page>
  );
}
