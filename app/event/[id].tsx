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
import { DjAvatarRow } from "../../components/DjAvatarRow";
import { ReviewCard, ReviewCardSkeleton } from "../../components/ReviewCard";
import { useEventDetail } from "../../lib/api/hooks";
import { formatDate } from "../../lib/format";
import { ROUTES } from "../../lib/routes";

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
        {data.series ? (
          <Link href={ROUTES.SERIES(data.series.slug)}>
            <Text className="text-2xl font-bold text-primary dark:text-primary-dark">{data.series.name}</Text>
          </Link>
        ) : (
          <Text className="text-2xl font-bold text-ink dark:text-paper">{data.event.name}</Text>
        )}
        <Text className="mt-1 text-muted">
          {data.event.venueId ? (
            <Link href={ROUTES.VENUE(data.event.venueId)}>
              <Text className="text-accent-text dark:text-accent-dark">{data.event.venue}</Text>
            </Link>
          ) : (
            data.event.venue
          )}
          {data.event.city ? ` · ${data.event.city}` : ""}
        </Text>
        {/* Date only: a night's time is just midday of the logged day. */}
        <Text className="mt-1 text-xs text-muted">{formatDate(data.event.eventDate)}</Text>
        {!!data.event.description && (
          <Text className="mt-3 text-ink dark:text-paper">{data.event.description}</Text>
        )}
        {!!data.lineup.length && (
          <View className="mt-4">
            <Text className="mb-2 text-sm font-semibold text-ink dark:text-paper">Lineup</Text>
            <DjAvatarRow items={data.lineup.map((dj) => ({ dj }))} />
          </View>
        )}
      </PageHeader>
      <FlatList
        contentContainerStyle={contentStyle}
        data={data.reviews}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReviewCard review={item} />}
        ListEmptyComponent={<EmptyState message="No reviews yet for this night." />}
      />
    </Page>
  );
}
