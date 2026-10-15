import { Link, useLocalSearchParams } from "expo-router";
import { FlatList, Pressable, View } from "react-native";

import {
  EmptyState,
  FadeInView,
  FitText,
  LoadingFade,
  SectionTitle,
  Skeleton,
  Text,
  TornCardSeparator,
  usePageContentStyle,
} from "../../components/ui";
import { DetailPage } from "../../components/DetailPage";
import { ReviewCard } from "../../components/ReviewCard";
import { useVenueDetail } from "../../lib/api/hooks";
import type { VenueDetail } from "../../lib/api/types";
import { plural } from "../../lib/format";
import { ROUTES } from "../../lib/routes";

// A named event people have logged at this venue, linking to its page.
function VenueEventRow({ item }: { item: VenueDetail["events"][number] }) {
  return (
    <Link href={ROUTES.EVENT(item.event.slug)} asChild>
      <Pressable className="border border-white/10 bg-zine-panel/90 p-4 active:opacity-80">
        <Text className="font-display text-2xl uppercase leading-7 text-paper">{item.event.name}</Text>
        <Text className="mt-1 font-display text-base uppercase text-zine-red-ink">
          {plural(item.reviewCount, "night")} logged here
        </Text>
      </Pressable>
    </Link>
  );
}

function VenueSkeleton() {
  const contentStyle = usePageContentStyle("roomy");

  return (
    <View style={contentStyle}>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-2 h-4 w-36" />
      <View className="mt-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <LoadingFade key={i} className="border border-white/5 bg-zine-panel/40 p-4">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="mt-2 h-5 w-28" />
          </LoadingFade>
        ))}
      </View>
    </View>
  );
}

export default function VenueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useVenueDetail(id);

  return (
    <DetailPage
      underHeader
      query={query}
      title={(data) => data.venue.name}
      skeleton={<VenueSkeleton />}
      missing="This venue isn't on Beatboxd."
    >
      {(data) => <VenueDetailList data={data} />}
    </DetailPage>
  );
}

function VenueDetailList({ data }: { data: VenueDetail }) {
  const contentStyle = usePageContentStyle("roomy");
  const { venue } = data;

  return (
    <FlatList
      contentContainerStyle={contentStyle}
      data={data.recentReviews}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => <ReviewCard review={item} index={index} />}
      ItemSeparatorComponent={TornCardSeparator}
      ListHeaderComponent={
        <View>
          <FadeInView>
            <Text className="font-display text-lg uppercase text-zine-red-ink">Venue</Text>
            <FitText fontSize={60} numberOfLines={3} className="text-paper">
              {venue.name}
            </FitText>
            {!!venue.address && <Text className="mt-1 text-sm text-paper/70">{venue.address}</Text>}
            {/* Google's terms require crediting Places data wherever it's shown. */}
            {!!venue.googlePlaceId && (
              <Text className="mt-1 text-[10px] text-paper/40">Venue details from Google Maps</Text>
            )}
            <Text className="mt-1 font-display text-lg uppercase text-paper/70">
              {venue.city && !venue.address ? `${venue.city} · ` : ""}
              {plural(venue.reviewCount, "night")} logged
            </Text>
          </FadeInView>
          {!!data.events.length && (
            <View className="mt-6 gap-2">
              <SectionTitle>Events here</SectionTitle>
              <View className="gap-3">
                {data.events.map((item, index) => (
                  <FadeInView key={item.event.id} index={index}>
                    <VenueEventRow item={item} />
                  </FadeInView>
                ))}
              </View>
            </View>
          )}
          {!!data.recentReviews.length && (
            <>
              <View className="mt-6" />
              <SectionTitle>Recent reviews</SectionTitle>
            </>
          )}
          <View className="h-4" />
        </View>
      }
      ListEmptyComponent={
        <View className="mt-10">
          <EmptyState message="No nights logged at this venue yet." />
        </View>
      }
    />
  );
}
