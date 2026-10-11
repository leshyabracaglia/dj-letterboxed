import { Link, Stack, useLocalSearchParams } from "expo-router";
import { FlatList, Pressable, View } from "react-native";

import { DjAvatarRow } from "../../components/DjAvatarRow";
import { Poster, POSTER_RECORD_STYLE } from "../../components/Poster";
import { ReviewCard, ReviewCardSkeleton } from "../../components/ReviewCard";
import { EmptyState, FadeInView, FitText, Page, Skeleton, Text, usePageContentStyle } from "../../components/ui";
import { useEventDetail } from "../../lib/api/hooks";
import type { EventDetail } from "../../lib/api/types";
import { ROUTES } from "../../lib/routes";

// How many of the most-logged DJs the poster lists as its lineup.
const POSTER_LINEUP = 6;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function EventSkeleton() {
  const contentStyle = usePageContentStyle();
  return (
    <Page underHeader>
      <View style={[contentStyle, { paddingTop: 0 }]}>
        <Skeleton className="mb-4 h-80 w-full rounded-none" />
        <ReviewCardSkeleton count={3} />
      </View>
    </Page>
  );
}

// The event as a gig poster, like the one you fill in when logging a night:
// its name headlining, the DJs people saw as the lineup (each a link), the record showing
// how it rates, and where it's been along the bottom strip.
function EventPoster({ data }: { data: EventDetail }) {
  const { event } = data;
  const lineup = data.djs.slice(0, POSTER_LINEUP);
  const moreDjs = data.djs.length - lineup.length;
  const [venue] = data.venues;
  return (
    <Poster>
      <View className="flex-row items-center justify-between px-3 pt-3">
        <Text className="font-display text-sm uppercase tracking-widest text-paper/80">Beatboxd presents</Text>
        <Text className="font-display text-sm uppercase text-stamp-red">Event</Text>
      </View>

      <View style={POSTER_RECORD_STYLE} className="items-center justify-center bg-zine-purple">
        <Text className="font-display text-sm uppercase leading-4 text-paper/80">Avg</Text>
        <Text className="font-numeric text-4xl leading-9 text-paper">
          {event.avgRating == null ? "–" : event.avgRating.toFixed(1)}
        </Text>
        <Text className="font-display text-xs leading-3 text-paper/80">of 5</Text>
      </View>

      <View className="px-3 pb-3 pt-24">
        <View style={{ paddingRight: 72 }}>
          <FitText fontSize={52} numberOfLines={4} className="text-paper" lastWordClassName="text-stamp-red">
            {event.name}
          </FitText>
        </View>
        {!!lineup.length && (
          <Text className="mt-3 font-display text-lg uppercase leading-5 text-paper">
            {lineup.map(({ dj }, i) => (
              <Text key={dj.id} className="font-display text-paper">
                {!!i && " · "}
                <Link href={ROUTES.DJ(dj.slug)} className="font-display text-paper">
                  {dj.name}
                </Link>
              </Text>
            ))}
            {moreDjs > 0 && <Text className="font-display text-primary-dark">{` · +${moreDjs} more`}</Text>}
          </Text>
        )}
      </View>

      <View className="flex-row border-t border-white/15">
        <View className="flex-1 border-r border-white/15 p-3">
          <Text className="font-display text-sm uppercase leading-4 text-paper/60">
            {data.venues.length > 1 ? `${data.venues.length} venues` : "Venue"}
          </Text>
          {venue ? (
            <Link href={ROUTES.VENUE(venue.id)} asChild>
              <Pressable className="active:opacity-70">
                <Text numberOfLines={2} className="mt-1 font-display text-xl uppercase leading-5 text-paper">
                  {venue.name}
                </Text>
                {!!venue.city && (
                  <Text numberOfLines={1} className="text-xs text-paper/60">
                    {venue.city}
                  </Text>
                )}
              </Pressable>
            </Link>
          ) : (
            <Text className="mt-1 font-display text-xl uppercase leading-5 text-paper/40">TBA</Text>
          )}
        </View>
        <View className="p-3">
          <Text className="font-display text-sm uppercase leading-4 text-paper/60">Logged</Text>
          <Text className="mt-1 font-display text-xl uppercase leading-5 text-paper">
            {plural(event.logCount, "night")}
          </Text>
          <Text className="text-xs text-paper/60">{plural(event.reviewCount, "review")}</Text>
        </View>
      </View>
    </Poster>
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

  return (
    <Page underHeader>
      <Stack.Screen options={{ title: data.event.name }} />
      <FlatList
        contentContainerStyle={[contentStyle, { paddingTop: 0 }]}
        data={data.recentReviews}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <ReviewCard review={item} index={index} />}
        ListHeaderComponent={
          <View className="mb-2">
            <FadeInView>
              <EventPoster data={data} />
            </FadeInView>
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
