import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, TextInput, View } from "react-native";

import {
  DashedButton,
  Icon,
  type IconName,
  KEYBOARD_DISMISS_PROPS,
  KeyboardScrollView,
  paperAt,
  Sheet,
  Skeleton,
  Text,
  usePageContentStyle,
} from "../ui";
import { ApiError, useApi } from "../../lib/api/client";
import { useEventSearch } from "../../lib/api/hooks";
import { queryKeys } from "../../lib/api/queryKeys";
import type {
  CheckInInput,
  CheckInResponse,
  EventSummary,
  NearbyVenue,
  NearbyVenuesResponse,
  RAArea,
  RAEvent,
  RAEventsResponse,
} from "../../lib/api/types";
import { parseDateInputValue, toDateInputValue } from "../../lib/format";
import { getCurrentPlace, getPreciseFix } from "../../lib/location";
import { useDebouncedValue, withTimeout } from "../../lib/utils";
import { addDays, type IBlankSeed, nightsLogged, shortDayLabel, startOfToday } from "./draft";
import { FieldLabel, NO_WEB_OUTLINE, SearchField, SheetRow, SheetSkeletonRow } from "./fields";

// ---- Find the night ----------------------------------------------------

// How far back the search looks: most logs are about last night.
const RANGES = [
  { days: 3, label: "Last 3 nights" },
  { days: 7, label: "Past week" },
] as const;

// How long to wait on the location prompt and a fix before falling back to
// the city of your latest log.
const LOCATE_TIMEOUT_MS = 10_000;

// "Tonight", "Last night", else "Sat 3 Oct".
function nightLabel(day: string) {
  const today = toDateInputValue(new Date());
  if (day === today) return "Tonight";
  if (day === toDateInputValue(addDays(startOfToday(), -1))) return "Last night";
  const date = parseDateInputValue(day);
  return date ? shortDayLabel(date) : day;
}

function raEventMatchesQuery(event: RAEvent, q: string) {
  const needle = q.toLowerCase();
  return [event.title, event.venue.name, ...event.artists.map((a) => a.name)].some((s) =>
    s.toLowerCase().includes(needle),
  );
}

// Pick an RA area (city or region) to list nights from.
function AreaSheet({ onPick, onClose }: { onPick: (area: RAArea) => void; onClose: () => void }) {
  const api = useApi();
  const [value, setValue] = useState("");
  const query = useDebouncedValue(value.trim(), 250);
  const { data, isFetching } = useQuery({
    queryKey: queryKeys.ra.areas(query),
    queryFn: () => api.get<RAArea[]>("/ra/areas", { q: query }),
    enabled: query.length > 1,
    retry: false,
  });
  const areas = query.length > 1 ? (data ?? []) : [];
  return (
    <Sheet title="Where are you?" onClose={onClose}>
      <SearchField value={value} onChangeText={setValue} placeholder="Berlin, New York, London…" />
      <ScrollView className="mt-3 shrink" {...KEYBOARD_DISMISS_PROPS}>
        {isFetching && !areas.length && <SheetSkeletonRow />}
        {areas.map((area) => (
          <SheetRow
            key={area.id}
            left={<Icon name="location" size={20} className="text-primary-dark" />}
            title={area.name}
            subtitle={area.country}
            onPress={() => onPick(area)}
          />
        ))}
        {!isFetching && query.length > 1 && !areas.length && (
          <Text className="px-4 py-3 text-paper/60">No Resident Advisor area matches &ldquo;{query}&rdquo;</Text>
        )}
      </ScrollView>
    </Sheet>
  );
}

// A small square chip under the search box ("NEAR BROOKLYN").
function FilterChip({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-1.5 border-2 border-paper/70 px-2 py-1 active:opacity-70"
    >
      <Icon name={icon} size={12} className="text-paper" />
      <Text className="font-display text-base uppercase leading-5 text-paper">{label}</Text>
    </Pressable>
  );
}

// A night from RA as a row: its flyer (or a little ringed poster), name,
// venue, lineup, and how many people said they were going.
function RAEventRow({
  event,
  index,
  loading,
  disabled,
  onPress,
}: {
  event: RAEvent;
  index: number;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const paper = paperAt(index);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="flex-row gap-3 border border-white/10 bg-zine-panel/90 p-2 active:opacity-80"
    >
      {event.flyerUrl ? (
        <Image source={{ uri: event.flyerUrl }} style={{ width: 56, height: 72 }} resizeMode="cover" />
      ) : (
        <View
          style={{ width: 56, height: 72 }}
          className={`items-center justify-center ${paper.tint === "accent" ? "bg-zine-red" : "bg-zine-purple"}`}
        >
          <View className="h-8 w-8 rounded-full border-2 border-paper/70 bg-ink" />
        </View>
      )}
      <View className="flex-1">
        <Text numberOfLines={2} className="font-display text-xl uppercase leading-5 text-paper">
          {event.title}
        </Text>
        <Text numberOfLines={1} className="mt-0.5 text-xs text-paper/60">
          {[event.venue.name, event.venue.area].filter(Boolean).join(" · ")}
        </Text>
        {!!event.artists.length && (
          <Text numberOfLines={1} className="mt-0.5 font-display text-sm uppercase leading-4 text-primary-dark">
            {event.artists.map((a) => a.name).join(" · ")}
          </Text>
        )}
        <View className="mt-1 flex-row items-center gap-2">
          <View className="border border-paper/60 px-1">
            <Text className="font-display text-xs uppercase leading-4 text-paper">RA</Text>
          </View>
          {!!event.attending && <Text className="text-xs text-paper/60">{event.attending.toLocaleString()} going</Text>}
        </View>
      </View>
      <View className="justify-center pr-1">
        {loading ? (
          <ActivityIndicator size="small" color="#F6F6F9" />
        ) : (
          <Icon name="chevron-forward" size={18} className="text-paper/60" />
        )}
      </View>
    </Pressable>
  );
}

// Nothing on RA matched: start a poster with the typed text in a slot.
function NotOnTheWall({ query, onStart }: { query: string; onStart: (seed: IBlankSeed) => void }) {
  const options: {
    type: "event" | "dj" | "venue";
    title: string;
    subtitle: string;
    icon: IconName;
    className: string;
  }[] = [
    {
      type: "event",
      title: "The party's name",
      subtitle: "Then where, when, who played",
      icon: "albums-outline",
      className: "bg-zine-red",
    },
    {
      type: "dj",
      title: "A DJ",
      subtitle: "We'll check Spotify, then ask where you saw them",
      icon: "headset-outline",
      className: "bg-zine-purple",
    },
    {
      type: "venue",
      title: "A venue",
      subtitle: "Search Google Places for it",
      icon: "location-outline",
      className: "bg-[#0B090A] border border-white/15",
    },
  ];
  return (
    <View>
      <Text className="font-display text-2xl uppercase leading-6 text-paper">Not on the wall yet</Text>
      <Text className="mt-1 text-sm text-paper/70">
        Nothing on Resident Advisor matches &ldquo;{query}&rdquo;. Make the first poster for it.
      </Text>
      <View className="mt-4 gap-2">
        <Text className="font-display text-sm uppercase text-paper/50">&ldquo;{query}&rdquo; is…</Text>
        {options.map((o) => (
          <Pressable
            key={o.type}
            onPress={() => onStart({ type: o.type, text: query })}
            className={`flex-row items-center gap-3 px-3 py-3 active:opacity-80 ${o.className}`}
          >
            <Icon name={o.icon} size={20} className="text-paper" />
            <View className="flex-1">
              <Text className="font-display text-xl uppercase leading-5 text-paper">{o.title}</Text>
              <Text className="text-xs text-paper/75">{o.subtitle}</Text>
            </View>
            <Icon name="chevron-forward" size={18} className="text-paper" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// Out right now: check in at the venue, so your log of tonight there shows
// as verified whenever you post it. Location is read only on tapping (a fresh
// precise fix), sent to find the venue you're at, and not kept.
function CheckInStrip() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [choices, setChoices] = useState<{ fix: CheckInInput; venues: NearbyVenue[] }>();
  const [message, setMessage] = useState<string>();

  const checkIn = useMutation({
    mutationFn: (input: CheckInInput) => api.post<CheckInResponse>("/check-ins", input),
    onSuccess: () => {
      setChoices(undefined);
      setMessage(undefined);
      // A log of tonight already posted there now shows as verified.
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.activity() });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) =>
      setMessage(
        err instanceof ApiError && err.code === "TOO_FAR"
          ? "You don't seem to be there. Try again once you're inside."
          : err instanceof ApiError && err.code === "IMPRECISE_LOCATION"
            ? "Your location is too rough to check in. Turn on precise location and try again."
            : "Couldn't check in. Try again.",
      ),
  });
  const locate = useMutation({
    mutationFn: async () => {
      const fix = await withTimeout(getPreciseFix(), LOCATE_TIMEOUT_MS).catch(() => null);
      if (!fix) return null;
      const { venues } = await api.get<NearbyVenuesResponse>("/check-ins/nearby", {
        lat: fix.latitude,
        lng: fix.longitude,
      });
      return {
        fix: { venueId: "", latitude: fix.latitude, longitude: fix.longitude, accuracyM: fix.accuracy },
        venues,
      };
    },
    onSuccess: (found) => {
      setMessage(undefined);
      if (!found) {
        setMessage("Couldn't get your location. Allow location access to check in.");
      } else if (!found.venues.length) {
        setMessage("No venue on Beatboxd right here yet. Log it from Google Places and you can check in next time.");
      } else if (found.venues.length === 1) {
        checkIn.mutate({ ...found.fix, venueId: found.venues[0].id });
      } else {
        setChoices(found);
      }
    },
    onError: () => setMessage("Couldn't check in. Try again."),
  });
  const busy = locate.isPending || checkIn.isPending;

  if (checkIn.data) {
    return (
      <View className={`flex-row items-center gap-3 border-2 border-primary-dark bg-ink px-3 py-3`}>
        <Icon name="checkmark-circle" size={22} className="text-primary-dark" />
        <View className="flex-1">
          <Text className="font-display text-xl uppercase leading-5 text-paper">
            Checked in at {checkIn.data.venue.name}
          </Text>
          <Text className="text-xs text-paper/70">Log tonight any time and it&apos;ll show as verified.</Text>
        </View>
      </View>
    );
  }
  return (
    <View>
      <Pressable
        onPress={() => locate.mutate()}
        disabled={busy}
        accessibilityRole="button"
        className="flex-row items-center gap-3 border-2 border-dashed border-paper/50 px-3 py-3 active:opacity-70"
      >
        <Icon name="checkmark-circle-outline" size={22} className="text-paper" />
        <View className="flex-1">
          <Text className="font-display text-xl uppercase leading-5 text-paper">Out right now? Check in</Text>
          <Text className="text-xs text-paper/60">Your log of tonight shows as verified: you were there.</Text>
        </View>
        {busy && <ActivityIndicator size="small" color="#F6F6F9" />}
      </Pressable>
      {!!choices && (
        <View className="mt-2 gap-1">
          <Text className="font-display text-sm uppercase text-paper/50">Which one are you at?</Text>
          <View className="gap-2">
            {choices.venues.map((venue) => (
              <Pressable
                key={venue.id}
                onPress={() => checkIn.mutate({ ...choices.fix, venueId: venue.id })}
                disabled={busy}
                className="flex-row items-center gap-3 border border-white/10 bg-zine-panel/90 px-3 py-2 active:opacity-80"
              >
                <Icon name="location-outline" size={16} className="text-paper" />
                <View className="flex-1">
                  <Text numberOfLines={1} className="font-display text-lg uppercase leading-5 text-paper">
                    {venue.name}
                  </Text>
                  {!!venue.city && <Text className="text-xs text-paper/60">{venue.city}</Text>}
                </View>
                <Text className="text-xs text-paper/60">{venue.distanceM}m</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      {!!message && <Text className="mt-2 text-sm text-paper/70">{message}</Text>}
    </View>
  );
}

// The log tab opens here: one box over the nights listed on Resident
// Advisor near you lately (most logs are about last night), and parties
// already on Beatboxd. Picking an RA night fills the poster from it; a blank
// poster is always one tap away.
export function FindTheNight({
  matchingId,
  onPickRA,
  onPickEvent,
  onStartBlank,
}: {
  matchingId?: string;
  onPickRA: (event: RAEvent) => void;
  onPickEvent: (event: EventSummary) => void;
  onStartBlank: (seed?: IBlankSeed) => void;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const contentStyle = usePageContentStyle();
  const [value, setValue] = useState("");
  // A city picked by hand; unset = where you are now, as the server finds it
  // (or, without location, the city of your latest log).
  const [area, setArea] = useState<RAArea>();
  const [rangeIndex, setRangeIndex] = useState(0);
  const [areaSheet, setAreaSheet] = useState(false);
  const query = value.trim();
  const range = RANGES[rangeIndex];
  const to = toDateInputValue(new Date());
  const from = toDateInputValue(addDays(startOfToday(), -(range.days - 1)));

  // Where you are, each time the log tab is opened (a fix from the last ten
  // minutes is reused). The OS asks for permission the first time; saying
  // no - or a prompt left unanswered, or no fix within a few seconds - falls
  // back to your latest log's city.
  const { data: here, isPending: locating } = useQuery({
    queryKey: queryKeys.location(),
    queryFn: () => withTimeout(getCurrentPlace(), LOCATE_TIMEOUT_MS).catch(() => null),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  useFocusEffect(
    useCallback(() => {
      queryClient.refetchQueries({ queryKey: queryKeys.location(), stale: true });
    }, [queryClient]),
  );
  // The device names the city where it can; on web the server geocodes the
  // coordinates, rounded to 2 decimals (about 1km) since only the city is
  // needed - App Store privacy counts 3+ decimals as precise location.
  const where = area
    ? { areaId: area.id }
    : here
      ? here.city || here.region
        ? { city: here.city, region: here.region }
        : { lat: here.latitude.toFixed(2), lng: here.longitude.toFixed(2) }
      : {};

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.ra.events(where, from, to),
    queryFn: () => api.get<RAEventsResponse>("/ra/events", { ...where, from, to }),
    // Wait for a location before falling back to your latest log's city.
    enabled: !!area || !locating,
    placeholderData: keepPreviousData,
    retry: 1,
  });
  const debounced = useDebouncedValue(query, 200);
  const { data: parties } = useEventSearch(debounced);
  const shownArea = area ?? data?.area ?? undefined;

  const events = (data?.events ?? []).filter((e) => !query || raEventMatchesQuery(e, query));
  // Newest night first; within a night, RA's most-attended order.
  const days = [...new Set(events.map((e) => e.date))].sort().reverse();
  const matchingParties = query ? (parties ?? []).slice(0, 3) : [];
  const nothingFound = !!query && !isLoading && !events.length && !matchingParties.length;

  return (
    <>
      <KeyboardScrollView contentContainerStyle={contentStyle}>
        <View className="mt-2" />
        <FieldLabel>Who, where, or what party?</FieldLabel>
        <View className="mt-1 flex-row items-center gap-2 border-2 border-paper/80 bg-ink px-3">
          <Icon name="search" size={16} className="text-paper/70" />
          <TextInput
            placeholder="DJ, venue or party name"
            value={value}
            onChangeText={setValue}
            autoCorrect={false}
            className="flex-1 py-3 text-paper placeholder:text-paper/40"
            style={NO_WEB_OUTLINE}
          />
          {!!value && (
            <Pressable onPress={() => setValue("")} hitSlop={8} accessibilityLabel="Clear search">
              <Icon name="close" size={18} className="text-paper/70" />
            </Pressable>
          )}
        </View>
        <View className="mt-2 flex-row flex-wrap gap-2">
          <FilterChip
            icon="location-outline"
            label={shownArea?.name ? `Near ${shownArea.name}` : locating && !area ? "Finding you…" : "Pick your city"}
            onPress={() => setAreaSheet(true)}
          />
          <FilterChip
            icon="calendar-outline"
            label={range.label}
            onPress={() => setRangeIndex((i) => (i + 1) % RANGES.length)}
          />
        </View>
        {!query && (
          <>
            <View className="mt-4" />
            <CheckInStrip />
          </>
        )}

        {(isLoading || (locating && !area)) && (
          <View className="mt-4 gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </View>
        )}
        {isError && !data && (
          <Text className="mt-4 text-paper/60">Couldn&apos;t reach Resident Advisor. Start a blank poster below.</Text>
        )}
        {!isLoading && !(locating && !area) && !shownArea && !query && (
          <Pressable
            onPress={() => setAreaSheet(true)}
            className="mt-4 border border-dashed border-paper/50 p-4 active:opacity-70"
          >
            <Text className="font-display text-xl uppercase text-paper">Where do you go out?</Text>
            <Text className="text-sm text-paper/60">
              Pick your city to see the nights on Resident Advisor near you.
            </Text>
          </Pressable>
        )}

        {days.map((day, dayIndex) => (
          <View key={day} className="mt-4 gap-2">
            <View className="flex-row items-end justify-between">
              <View className="flex-row items-end gap-2">
                <Text className="font-numeric text-2xl leading-7 text-stamp-red">
                  {String(dayIndex + 1).padStart(2, "0")}
                </Text>
                <Text className="font-display text-xl uppercase leading-6 text-paper">
                  {nightLabel(day)}
                  {shownArea?.name ? ` near ${shownArea.name}` : ""}
                </Text>
              </View>
            </View>
            <View className="gap-3">
              {events
                .filter((e) => e.date === day)
                .map((event, i) => (
                  <RAEventRow
                    key={event.id}
                    event={event}
                    index={i}
                    loading={matchingId === event.id}
                    disabled={!!matchingId}
                    onPress={() => onPickRA(event)}
                  />
                ))}
            </View>
          </View>
        ))}

        {!!matchingParties.length && (
          <View className="mt-4 gap-2">
            <Text className="font-display text-sm uppercase text-paper/50">Parties on Beatboxd</Text>
            {matchingParties.map((event, i) => (
              <Pressable
                key={event.id}
                onPress={() => onPickEvent(event)}
                className="flex-row items-center gap-3 border border-white/10 bg-zine-panel/90 px-3 py-2 active:opacity-80"
              >
                <View
                  className={`h-8 w-8 items-center justify-center rounded-full ${i % 2 ? "bg-zine-red" : "bg-zine-purple"}`}
                >
                  <Text className="font-numeric text-base leading-5 text-paper">{event.reviewCount}</Text>
                </View>
                <View className="flex-1">
                  <Text numberOfLines={1} className="font-display text-lg uppercase leading-5 text-paper">
                    {event.name}
                  </Text>
                  <Text className="text-xs text-paper/60">{nightsLogged(event.reviewCount)}</Text>
                </View>
                <View className="border border-paper/60 px-1">
                  <Text className="font-display text-xs uppercase leading-4 text-paper">Beatboxd</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {nothingFound ? (
          <>
            <View className="mt-4" />
            <NotOnTheWall query={query} onStart={onStartBlank} />
          </>
        ) : (
          <DashedButton
            label={query ? `Not here? Start a poster with “${query}”` : "Start a blank poster"}
            onPress={() => onStartBlank(query ? { type: "event", text: query } : undefined)}
            className="mt-4 py-3"
          />
        )}
        {!!data?.events.length && (
          <Text className="mt-6 text-right text-[10px] text-paper/40">Listings from Resident Advisor</Text>
        )}
      </KeyboardScrollView>
      {areaSheet && (
        <AreaSheet
          onPick={(picked) => {
            setArea(picked);
            setAreaSheet(false);
          }}
          onClose={() => setAreaSheet(false)}
        />
      )}
    </>
  );
}
