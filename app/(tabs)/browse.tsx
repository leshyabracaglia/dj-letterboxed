import { useState } from "react";
import { Link } from "expo-router";
import { FlatList, Pressable, TextInput, View } from "react-native";

import {
  Avatar,
  Card,
  type CardTint,
  EmptyState,
  GenreTags,
  KEYBOARD_DISMISS_PROPS,
  Page,
  Photo,
  RatingStamp,
  SegmentedTabs,
  Skeleton,
  Text,
  tiltFor,
  usePageContentStyle,
} from "../../components/ui";
import { FollowButton } from "../../components/FollowButton";
import { useDjSearch, useEventSearch, useUserSearch, useVenueSearch } from "../../lib/api/hooks";
import type { Dj, EventSummary, User, VenueSummary } from "../../lib/api/types";
import { useCurrentUser } from "../../lib/auth";
import { ROUTES } from "../../lib/routes";

function DjCard({ dj }: { dj: Dj }) {
  return (
    <Card href={ROUTES.DJ(dj.slug)} tint="primary" tilt={tiltFor(dj.id, 0.8)}>
      <View className="flex-row items-center gap-4">
        <Photo uri={dj.imageUrl} width={64} height={72} framed rotate={-2} />
        <View className="flex-1">
          <Text className="font-display text-3xl uppercase leading-8 text-paper" numberOfLines={2}>
            {dj.name}
          </Text>
          {!!dj.genres?.length && (
            <View className="mt-1.5">
              <GenreTags genres={dj.genres} limit={3} />
            </View>
          )}
        </View>
      </View>
    </Card>
  );
}

function VenueCard({ venue }: { venue: VenueSummary }) {
  return (
    <Card href={ROUTES.VENUE(venue.id)} tilt={tiltFor(venue.id, 0.6)}>
      <Text className="font-display text-3xl uppercase leading-8 text-paper">{venue.name}</Text>
      <Text className="mt-1 font-display text-base uppercase text-paper/60">
        {venue.city ? `${venue.city} · ` : ""}
        {venue.logCount} {venue.logCount === 1 ? "night" : "nights"} logged
      </Text>
    </Card>
  );
}

// An event ("Innervisions NY") with its totals across every log of it.
function EventCard({ event }: { event: EventSummary }) {
  return (
    <Card href={ROUTES.EVENT(event.slug)} tint="accent" tilt={tiltFor(event.id, 0.8)}>
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="font-display text-3xl uppercase leading-8 text-paper">{event.name}</Text>
          <Text className="mt-1 font-display text-base uppercase text-zine-red-ink">
            {event.logCount} {event.logCount === 1 ? "night" : "nights"} · {event.reviewCount}{" "}
            {event.reviewCount === 1 ? "review" : "reviews"}
          </Text>
        </View>
        {event.avgRating !== null && <RatingStamp value={event.avgRating} size={52} />}
      </View>
    </Card>
  );
}

// Not a Card href: the follow button sits inside, and a pressable nested in
// a Link would trigger both. Only the avatar/name side navigates.
function UserCard({ user, isSelf }: { user: User; isSelf: boolean }) {
  return (
    <Card>
      <View className="flex-row items-center gap-3">
        <Link href={ROUTES.USER(user.username)} asChild>
          <Pressable className="flex-1 flex-row items-center gap-3 active:opacity-80">
            <Avatar uri={user.avatarUrl} name={user.username} size={48} />
            <View className="flex-1">
              <Text className="font-display text-2xl uppercase text-paper">@{user.username}</Text>
            </View>
          </Pressable>
        </Link>
        {!isSelf && <FollowButton userId={user.id} />}
      </View>
    </Card>
  );
}

function BrowseCardSkeleton({ tint }: { tint: CardTint }) {
  // Dark ink on the purple/red stock; the near-black panel keeps the light block.
  const tone = tint === "neutral" ? "wall" : "paper";
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} blank tint={tint}>
          <View className="flex-row items-center gap-4">
            {tint !== "accent" && <Skeleton tone={tone} className="h-[72px] w-16 rounded-none" />}
            <View className="flex-1">
              <Skeleton tone={tone} className="h-7 w-40" />
              <Skeleton tone={tone} className="mt-2 h-4 w-28" />
            </View>
          </View>
        </Card>
      ))}
    </>
  );
}

function SuggestionsLabel({ label }: { label: string }) {
  return (
    <Text className="mb-3 font-display text-xl uppercase text-paper/80">{label}</Text>
  );
}

const TABS = [
  { value: "djs", label: "DJs" },
  { value: "events", label: "Events" },
  { value: "venues", label: "Venues" },
  { value: "people", label: "People" },
] as const;

const COPY = {
  djs: { title: "Browse DJs", placeholder: "Search DJs...", suggestions: "Popular DJs" },
  events: {
    title: "Browse Events",
    placeholder: "Search events like Innervisions...",
    suggestions: "Popular events",
  },
  venues: { title: "Browse Venues", placeholder: "Search venues...", suggestions: "Popular venues" },
  people: {
    title: "Find People",
    placeholder: "Search by name or username...",
    suggestions: "Suggested people",
  },
} as const;

export default function BrowseScreen() {
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("djs");
  const [query, setQuery] = useState("");
  const contentStyle = usePageContentStyle();
  const { me } = useCurrentUser();

  const trimmed = query.trim();
  // An empty search shows the top few as suggestions instead of a blank list.
  const { data: djs } = useDjSearch(trimmed, { enabled: tab === "djs", suggest: true });
  // Lists every event until a search is typed - this tab doubles as the index.
  const { data: events } = useEventSearch(trimmed, tab === "events");
  const { data: users } = useUserSearch(trimmed, { enabled: tab === "people", suggest: true });
  const { data: venues } = useVenueSearch(trimmed, { enabled: tab === "venues", suggest: true });
  // FlatList's ListHeaderComponent takes an element or null, not `false`.
  const suggestionsHeader = (hasRows: boolean) =>
    hasRows && !trimmed.length ? <SuggestionsLabel label={COPY[tab].suggestions} /> : null;

  return (
    <Page
      title={COPY[tab].title}
      channel="CH 02 · Browse"
      header={
        <>
          <View className="mb-3">
            <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />
          </View>
          <TextInput
            placeholder={COPY[tab].placeholder}
            value={query}
            onChangeText={setQuery}
            placeholderTextColor="rgba(246,246,249,0.4)"
            className="rounded-md border-2 border-white/15 bg-zine-panel/90 focus:border-paper px-4 py-3 text-base text-paper"
          />
        </>
      }
    >
      {tab === "djs" ? (
        <FlatList
          {...KEYBOARD_DISMISS_PROPS}
          contentContainerStyle={contentStyle}
          data={djs ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <DjCard dj={item} />}
          ListHeaderComponent={suggestionsHeader(!!djs?.length)}
          ListEmptyComponent={
            !djs ? (
              <BrowseCardSkeleton tint="primary" />
            ) : trimmed.length ? (
              <EmptyState message="No DJs found. Add one when you review a set." />
            ) : (
              <EmptyState message="No DJs yet. Add one when you review a set." />
            )
          }
        />
      ) : tab === "events" ? (
        <FlatList
          {...KEYBOARD_DISMISS_PROPS}
          contentContainerStyle={contentStyle}
          data={events ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <EventCard event={item} />}
          ListEmptyComponent={
            !events ? (
              <BrowseCardSkeleton tint="accent" />
            ) : trimmed.length ? (
              <EmptyState message="No events found. Add one when you review a set." />
            ) : (
              <EmptyState message="No events yet. Name one when you review a set." />
            )
          }
        />
      ) : tab === "people" ? (
        <FlatList
          {...KEYBOARD_DISMISS_PROPS}
          contentContainerStyle={contentStyle}
          data={users ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <UserCard user={item} isSelf={item.id === me?.id} />}
          ListHeaderComponent={suggestionsHeader(!!users?.length)}
          ListEmptyComponent={
            !users ? (
              <BrowseCardSkeleton tint="neutral" />
            ) : trimmed.length ? (
              <EmptyState message="No people found." />
            ) : (
              <EmptyState message="Search for people to follow and see their sets in your feed." />
            )
          }
        />
      ) : (
        <FlatList
          {...KEYBOARD_DISMISS_PROPS}
          contentContainerStyle={contentStyle}
          data={venues ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <VenueCard venue={item} />}
          ListHeaderComponent={suggestionsHeader(!!venues?.length)}
          ListEmptyComponent={
            !venues ? (
              <BrowseCardSkeleton tint="neutral" />
            ) : trimmed.length ? (
              <EmptyState message="No venues found. Add one when you review a set." />
            ) : (
              <EmptyState message="No venues yet. Add one when you review a set." />
            )
          }
        />
      )}
    </Page>
  );
}
