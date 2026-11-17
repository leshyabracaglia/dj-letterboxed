import { Link, useLocalSearchParams } from "expo-router";
import { FlatList, Pressable, View } from "react-native";

import {
  Avatar,
  Card,
  EmptyState,
  FadeInView,
  FitText,
  SectionTitle,
  Skeleton,
  Text,
  TornCardSeparator,
  usePageContentStyle,
} from "@/components/ui";
import { DetailPage } from "@/components/DetailPage";
import { ReviewCard, ReviewCardSkeleton } from "@/components/ReviewCard";
import { useVenueDetail } from "@/lib/api/hooks";
import type { VenueDetail } from "@/lib/api/types";
import { plural } from "@/lib/format";
import { ROUTES } from "@/lib/routes";

// Who's been here by checking in: everyone counted, your friends by face
// and name (only friends are named; see GET /api/venues/{id}).
function WhosBeenHere({ checkIns }: { checkIns: VenueDetail["checkIns"] }) {
  if (!checkIns.people) return null;
  const { friends } = checkIns;
  return (
    <View className="mt-6 gap-2">
      <SectionTitle>Who&apos;s been here</SectionTitle>
      <Card className="gap-3">
        <Text variant="display" className="text-lg text-paper/80">
          {plural(checkIns.people, "person", "people")} checked in
          {!!friends.length && ` · ${plural(friends.length, "friend")}`}
        </Text>
        {!!friends.length && (
          <View className="flex-row flex-wrap gap-3">
            {friends.map((friend) => (
              <Link key={friend.id} href={ROUTES.USER(friend.username)} asChild>
                <Pressable className="items-center gap-1 active:opacity-80" accessibilityLabel={`@${friend.username}`}>
                  <Avatar uri={friend.avatarUrl} name={friend.username} size={44} />
                  <Text className="max-w-16 text-xs text-paper/70" numberOfLines={1}>
                    @{friend.username}
                  </Text>
                </Pressable>
              </Link>
            ))}
          </View>
        )}
      </Card>
    </View>
  );
}

// A named event people have logged at this venue, linking to its page.
function VenueEventRow({ item }: { item: VenueDetail["events"][number] }) {
  return (
    <Link href={ROUTES.EVENT(item.event.slug)} asChild>
      <Pressable className="border border-white/10 bg-zine-panel/90 p-4 active:opacity-80">
        <Text variant="display" className="text-2xl leading-7 text-paper">
          {item.event.name}
        </Text>
        <Text variant="display" className="mt-1 text-base text-zine-red-ink">
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
      <Skeleton className="h-4 w-14" />
      <Skeleton className="mt-2 h-14 w-60" />
      <Skeleton className="mt-2 h-4 w-40" />
      <View className="mt-8" />
      <ReviewCardSkeleton count={2} />
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
            <Text variant="display" className="text-lg text-zine-red-ink">
              Venue
            </Text>
            <FitText fontSize={60} numberOfLines={3} className="text-paper">
              {venue.name}
            </FitText>
            {!!venue.address && <Text className="mt-1 text-sm text-paper/70">{venue.address}</Text>}
            {/* Google's terms require crediting Places data wherever it's shown. */}
            {!!venue.googlePlaceId && (
              <Text className="mt-1 text-[10px] text-paper/40">Venue details from Google Maps</Text>
            )}
            <Text variant="display" className="mt-1 text-lg text-paper/70">
              {venue.city && !venue.address ? `${venue.city} · ` : ""}
              {plural(venue.reviewCount, "night")} logged
            </Text>
          </FadeInView>
          <WhosBeenHere checkIns={data.checkIns} />
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
