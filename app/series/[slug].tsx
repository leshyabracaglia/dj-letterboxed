import { useQuery } from "@tanstack/react-query";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { FlatList, Pressable, View } from "react-native";

import { DjAvatarRow } from "../../components/DjAvatarRow";
import { ReviewCard, ReviewCardSkeleton } from "../../components/ReviewCard";
import {
  EmptyState,
  Page,
  PageHeader,
  RatingStars,
  Skeleton,
  Text,
  usePageContentStyle,
} from "../../components/ui";
import { useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type { SeriesDetail } from "../../lib/api/types";
import { formatDate, formatRating } from "../../lib/format";
import { ROUTES } from "../../lib/routes";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function SeriesSkeleton() {
  const contentStyle = usePageContentStyle();
  return (
    <Page>
      <PageHeader border="primary">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-56" />
      </PageHeader>
      <View style={contentStyle}>
        <ReviewCardSkeleton count={3} />
      </View>
    </Page>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text className="mb-2 mt-5 text-sm font-semibold text-ink dark:text-paper">{children}</Text>;
}

// Everything about a recurring event ("Innervisions") across its nights:
// how it rates, who's played it and how often, where it's been, each
// night, and recent reviews.
export default function SeriesScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const api = useApi();
  const contentStyle = usePageContentStyle();
  const { data } = useQuery({
    queryKey: queryKeys.series.bySlug(slug!),
    queryFn: () => api.get<SeriesDetail>(`/series/${slug}`),
  });

  if (!data) {
    return <SeriesSkeleton />;
  }

  const { series } = data;

  return (
    <Page>
      <Stack.Screen options={{ title: series.name }} />
      <PageHeader border="primary">
        <Text className="text-2xl font-bold text-ink dark:text-paper">{series.name}</Text>
        <View className="mt-1 flex-row flex-wrap items-center gap-2">
          <RatingStars value={series.avgRating} size={16} />
          <Text className="text-muted">
            <Text className="font-numeric text-base text-ink dark:text-paper">
              {formatRating(series.avgRating)}
            </Text>{" "}
            · {plural(series.nightCount, "night")} · {plural(series.reviewCount, "review")}
          </Text>
        </View>
      </PageHeader>
      <FlatList
        contentContainerStyle={contentStyle}
        data={data.recentReviews}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReviewCard review={item} />}
        ListHeaderComponent={
          <View className="mb-2">
            {!!data.djs.length && (
              <>
                <SectionTitle>Who&apos;s played it</SectionTitle>
                <DjAvatarRow
                  items={data.djs.map(({ dj, nightCount }) => ({
                    dj,
                    caption: <Text className="text-xs text-muted">{plural(nightCount, "night")}</Text>,
                  }))}
                />
              </>
            )}

            {!!data.venues.length && (
              <>
                <SectionTitle>Where it&apos;s been</SectionTitle>
                {data.venues.map((venue) => (
                  <Link key={venue.id} href={ROUTES.VENUE(venue.id)} asChild>
                    <Pressable className="py-1 active:opacity-70">
                      <Text className="text-ink dark:text-paper">
                        {venue.name}
                        <Text className="text-sm text-muted">
                          {venue.city ? ` · ${venue.city}` : ""} · {plural(venue.nightCount, "night")}
                        </Text>
                      </Text>
                    </Pressable>
                  </Link>
                ))}
              </>
            )}

            <SectionTitle>Nights</SectionTitle>
            {data.nights.map(({ event, reviewCount, avgRating }) => (
              <Link key={event.id} href={ROUTES.EVENT(event.id)} asChild>
                <Pressable className="flex-row items-center justify-between border-b border-muted/10 py-2 active:opacity-70">
                  <View className="flex-1">
                    <Text className="text-ink dark:text-paper">{event.venue}</Text>
                    <Text className="text-xs text-muted">
                      {formatDate(event.eventDate)} · {plural(reviewCount, "review")}
                    </Text>
                  </View>
                  {avgRating !== null && <RatingStars value={avgRating} size={12} />}
                </Pressable>
              </Link>
            ))}

            <SectionTitle>Recent reviews</SectionTitle>
          </View>
        }
        ListEmptyComponent={<EmptyState message="No reviews yet for this event." />}
      />
    </Page>
  );
}
