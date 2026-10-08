import { Link, Stack, useLocalSearchParams } from "expo-router";
import { FlatList, Pressable, View } from "react-native";

import { DjAvatarRow } from "../../components/DjAvatarRow";
import { ReviewCard, ReviewCardSkeleton } from "../../components/ReviewCard";
import {
  EmptyState,
  FadeInView,
  FitText,
  Page,
  PageHeader,
  RatingStamp,
  Skeleton,
  Text,
  usePageContentStyle,
} from "../../components/ui";
import { useEventDetail } from "../../lib/api/hooks";
import { ROUTES } from "../../lib/routes";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function EventSkeleton() {
  const contentStyle = usePageContentStyle();
  return (
    <Page>
      <PageHeader border="accent">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-14 w-56" />
        <Skeleton className="mt-2 h-4 w-40" />
      </PageHeader>
      <View style={contentStyle}>
        <ReviewCardSkeleton count={3} />
      </View>
    </Page>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text className="mb-2 mt-6 font-display text-2xl uppercase text-paper/85">{children}</Text>;
}

// Everything logged about an event ("Innervisions NY") across every date,
// venue and day/night people went: how it rates, the DJs people saw and how
// often, where it's been, and recent reviews.
export default function EventScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const contentStyle = usePageContentStyle();
  const { data } = useEventDetail(slug);

  if (!data) {
    return <EventSkeleton />;
  }

  const { event } = data;

  return (
    <Page>
      <Stack.Screen options={{ title: event.name }} />
      <PageHeader border="accent">
        <FadeInView>
          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <Text className="font-display text-lg uppercase text-zine-red-ink">Event</Text>
              <FitText fontSize={60} numberOfLines={3} className="text-paper">
                {event.name}
              </FitText>
              <Text className="mt-1 font-display text-lg uppercase text-paper/70">
                {plural(event.logCount, "night")} logged · {plural(event.reviewCount, "review")}
              </Text>
            </View>
            <RatingStamp value={event.avgRating} size={92} />
          </View>
        </FadeInView>
      </PageHeader>
      <FlatList
        contentContainerStyle={contentStyle}
        data={data.recentReviews}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <ReviewCard review={item} index={index} />}
        ListHeaderComponent={
          <View className="mb-2">
            {!!data.djs.length && (
              <>
                <SectionTitle>Who people saw</SectionTitle>
                <DjAvatarRow
                  items={data.djs.map(({ dj, logCount }) => ({
                    dj,
                    caption: (
                      <Text className="font-display text-sm uppercase text-paper/60">{plural(logCount, "log")}</Text>
                    ),
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
                      <Text className="font-display text-xl uppercase text-paper">
                        {venue.name}
                        <Text className="text-paper/60">
                          {venue.city ? ` · ${venue.city}` : ""} · {plural(venue.logCount, "log")}
                        </Text>
                      </Text>
                    </Pressable>
                  </Link>
                ))}
              </>
            )}

            <SectionTitle>Recent reviews</SectionTitle>
          </View>
        }
        ListEmptyComponent={<EmptyState message="No reviews yet for this event." />}
      />
    </Page>
  );
}
