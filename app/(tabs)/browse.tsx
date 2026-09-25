import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, TextInput, View } from "react-native";

import {
  Avatar,
  Card,
  EmptyState,
  GenreTags,
  Page,
  Skeleton,
  Text,
  usePageContentStyle,
} from "../../components/ui";
import { useDjSearch } from "../../lib/api/hooks";
import { useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type { Dj, VenueSummary } from "../../lib/api/types";
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
          {dj.genres && dj.genres.length > 0 ? (
            <View className="mt-1.5">
              <GenreTags genres={dj.genres} limit={3} />
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

function VenueCard({ venue }: { venue: VenueSummary }) {
  return (
    <Card href={ROUTES.VENUE(venue.venue)} tint="accent">
      <Text className="text-lg font-semibold text-ink dark:text-paper">{venue.venue}</Text>
      <Text className="mt-1 text-sm text-muted">
        {venue.city ? `${venue.city} · ` : ""}
        {venue.eventCount} {venue.eventCount === 1 ? "event" : "events"} reviewed
      </Text>
    </Card>
  );
}

function BrowseCardSkeleton({ tint }: { tint: "primary" | "accent" }) {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} tint={tint}>
          <View className="flex-row items-center gap-3">
            {tint === "primary" ? <Skeleton className="h-12 w-12 rounded-full" /> : null}
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

const TABS = [
  { value: "djs", label: "DJs" },
  { value: "venues", label: "Venues" },
] as const;

export default function BrowseScreen() {
  const api = useApi();
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("djs");
  const [query, setQuery] = useState("");
  const contentStyle = usePageContentStyle();

  const { data: djs } = useDjSearch(query, tab === "djs");

  const { data: venues } = useQuery({
    queryKey: queryKeys.venues.search(query),
    queryFn: () => api.get<VenueSummary[]>("/venues/search", { q: query }),
    enabled: tab === "venues" && query.length > 0,
    placeholderData: keepPreviousData,
  });

  return (
    <Page
      ambient
      title={tab === "djs" ? "Browse DJs" : "Browse Venues"}
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
            placeholder={tab === "djs" ? "Search DJs..." : "Search venues..."}
            value={query}
            onChangeText={setQuery}
            className="rounded-xl border border-primary/20 bg-white dark:bg-surface-dark focus:border-primary px-4 py-3 text-ink dark:text-paper placeholder:text-muted"
          />
        </>
      }
    >
      {tab === "djs" ? (
        <FlatList
          contentContainerStyle={contentStyle}
          data={djs ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <DjCard dj={item} />}
          ListEmptyComponent={
            query.length > 0 && !djs ? (
              <BrowseCardSkeleton tint="primary" />
            ) : query.length > 0 ? (
              <EmptyState message="No DJs found. Add one when you review a set." />
            ) : (
              <EmptyState message="Search for a DJ to see their profile and reviews." />
            )
          }
        />
      ) : (
        <FlatList
          contentContainerStyle={contentStyle}
          data={venues ?? []}
          keyExtractor={(item) => item.venue}
          renderItem={({ item }) => <VenueCard venue={item} />}
          ListEmptyComponent={
            query.length > 0 && !venues ? (
              <BrowseCardSkeleton tint="accent" />
            ) : query.length > 0 ? (
              <EmptyState message="No venues found. Add one when you review a set." />
            ) : (
              <EmptyState message="Search for a venue to see events reviewed there." />
            )
          }
        />
      )}
    </Page>
  );
}
