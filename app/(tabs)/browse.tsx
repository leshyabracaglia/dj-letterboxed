import { useState } from "react";
import { Link } from "expo-router";
import { FlatList, Pressable, TextInput, View } from "react-native";

import {
  Avatar,
  Card,
  EmptyState,
  GenreTags,
  KEYBOARD_DISMISS_PROPS,
  Page,
  RatingStars,
  Skeleton,
  Text,
  usePageContentStyle,
} from "../../components/ui";
import { FollowButton } from "../../components/FollowButton";
import { useDjSearch, useSeriesSearch, useUserSearch, useVenueSearch } from "../../lib/api/hooks";
import type { Dj, SeriesSummary, User, VenueSummary } from "../../lib/api/types";
import { formatRating } from "../../lib/format";
import { useCurrentUser } from "../../lib/auth";
import { ROUTES } from "../../lib/routes";

function DjCard({ dj }: { dj: Dj }) {
  return (
    <Card href={ROUTES.DJ(dj.slug)} tint="primary">
      <View className="flex-row items-center gap-3">
        <Avatar uri={dj.imageUrl} name={dj.name} size={48} />
        <View className="flex-1">
          <Text className="text-lg font-semibold text-primary dark:text-primary-dark">
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
    <Card href={ROUTES.VENUE(venue.id)} tint="accent">
      <Text className="text-lg font-semibold text-ink dark:text-paper">{venue.name}</Text>
      <Text className="mt-1 text-sm text-muted">
        {venue.city ? `${venue.city} · ` : ""}
        {venue.eventCount} {venue.eventCount === 1 ? "event" : "events"} reviewed
      </Text>
    </Card>
  );
}

// A recurring event ("Innervisions") with its totals across all nights.
function SeriesCard({ series }: { series: SeriesSummary }) {
  return (
    <Card href={ROUTES.SERIES(series.slug)} tint="primary">
      <Text className="text-lg font-semibold text-primary dark:text-primary-dark">{series.name}</Text>
      <View className="mt-1 flex-row flex-wrap items-center gap-2">
        {series.avgRating !== null && <RatingStars value={series.avgRating} size={12} />}
        <Text className="text-sm text-muted">
          {series.avgRating !== null ? `${formatRating(series.avgRating)} · ` : ""}
          {series.nightCount} {series.nightCount === 1 ? "night" : "nights"} · {series.reviewCount}{" "}
          {series.reviewCount === 1 ? "review" : "reviews"}
        </Text>
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
              <Text className="text-lg font-semibold text-ink dark:text-paper">{user.username}</Text>
            </View>
          </Pressable>
        </Link>
        {isSelf ? null : <FollowButton userId={user.id} />}
      </View>
    </Card>
  );
}

function BrowseCardSkeleton({ tint }: { tint: "primary" | "accent" | "neutral" }) {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} tint={tint}>
          <View className="flex-row items-center gap-3">
            {tint !== "accent" && <Skeleton className="h-12 w-12 rounded-full" />}
            <View className="flex-1">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-2 h-3.5 w-28" />
            </View>
          </View>
        </Card>
      ))}
    </>
  );
}

function SuggestionsLabel({ label }: { label: string }) {
  return (
    <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{label}</Text>
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
  const { data: series } = useSeriesSearch(trimmed, tab === "events");
  const { data: users } = useUserSearch(trimmed, { enabled: tab === "people", suggest: true });
  const { data: venues } = useVenueSearch(trimmed, { enabled: tab === "venues", suggest: true });
  // FlatList's ListHeaderComponent takes an element or null, not `false`.
  const suggestionsHeader = (hasRows: boolean) =>
    hasRows && !trimmed.length ? <SuggestionsLabel label={COPY[tab].suggestions} /> : null;

  return (
    <Page
      ambient
      title={COPY[tab].title}
      header={
        <>
          <View className="mb-3 flex-row gap-2">
            {TABS.map((t) => (
              <Pressable
                key={t.value}
                onPress={() => setTab(t.value)}
                className={`rounded-full px-3 py-1.5 ${
                  tab === t.value ? "bg-primary" : "bg-white dark:bg-surface-dark border border-primary/20"
                }`}
              >
                <Text className={tab === t.value ? "text-paper" : "text-ink dark:text-paper"}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            placeholder={COPY[tab].placeholder}
            value={query}
            onChangeText={setQuery}
            className="rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary px-4 py-3 text-ink dark:text-paper placeholder:text-muted"
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
          data={series ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <SeriesCard series={item} />}
          ListEmptyComponent={
            !series ? (
              <BrowseCardSkeleton tint="primary" />
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
              <BrowseCardSkeleton tint="accent" />
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
