import { Link, Stack, useLocalSearchParams } from "expo-router";
import { FlatList, Pressable, View } from "react-native";

import {
  EmptyState,
  FadeInView,
  FitText,
  LoadingFade,
  Page,
  PageHeader,
  Skeleton,
  Text,
  usePageContentStyle,
} from "../../components/ui";
import { ReviewCard } from "../../components/ReviewCard";
import { useVenueDetail } from "../../lib/api/hooks";
import type { VenueDetail } from "../../lib/api/types";
import { ROUTES } from "../../lib/routes";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// A named event people have logged at this venue, linking to its page.
function VenueEventRow({ item }: { item: VenueDetail["events"][number] }) {
  return (
    <Link href={ROUTES.EVENT(item.event.slug)} asChild>
      <Pressable className="mb-3 border border-white/10 bg-zine-panel/90 p-4 active:opacity-80">
        <Text className="font-display text-2xl uppercase leading-7 text-paper">{item.event.name}</Text>
        <Text className="mt-1 font-display text-base uppercase text-zine-red-ink">
          {plural(item.logCount, "night")} logged here
        </Text>
      </Pressable>
    </Link>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text className="mb-2 mt-4 font-display text-2xl uppercase text-paper/85">{children}</Text>;
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
          <LoadingFade key={i} className="mb-3 border border-white/5 bg-zine-panel/40 p-4">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="mt-2 h-5 w-28" />
          </LoadingFade>
        ))}
      </View>
    </Page>
  );
}

export default function VenueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useVenueDetail(id);
  const contentStyle = usePageContentStyle();

  if (!data) {
    return <VenueSkeleton />;
  }
  const { venue } = data;

  return (
    <Page>
      <Stack.Screen options={{ title: venue.name }} />
      <PageHeader border="accent">
        <FadeInView>
          <Text className="font-display text-lg uppercase text-zine-red-ink">Venue</Text>
          <FitText fontSize={60} numberOfLines={3} className="text-paper">
            {venue.name}
          </FitText>
          {!!venue.address && <Text className="mt-1 text-sm text-paper/70">{venue.address}</Text>}
          <Text className="mt-1 font-display text-lg uppercase text-paper/70">
            {venue.city && !venue.address ? `${venue.city} · ` : ""}
            {plural(venue.logCount, "night")} logged
          </Text>
        </FadeInView>
      </PageHeader>
      <FlatList
        contentContainerStyle={contentStyle}
        data={data.recentReviews}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <ReviewCard review={item} index={index} />}
        ListHeaderComponent={
          <View className="mb-2">
            {!!data.events.length && (
              <>
                <SectionTitle>Events here</SectionTitle>
                {data.events.map((item, index) => (
                  <FadeInView key={item.event.id} index={index}>
                    <VenueEventRow item={item} />
                  </FadeInView>
                ))}
              </>
            )}
            {!!data.recentReviews.length && <SectionTitle>Recent reviews</SectionTitle>}
          </View>
        }
        ListEmptyComponent={<EmptyState message="No nights logged at this venue yet." />}
      />
    </Page>
  );
}
