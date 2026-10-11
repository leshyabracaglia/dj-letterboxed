import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { type ReactNode, type Ref, useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, Platform, Pressable, ScrollView, TextInput, View } from "react-native";

import { Poster, POSTER_FRAME, POSTER_RECORD_STYLE } from "../../components/Poster";
import { TagFriendsPicker } from "../../components/TagFriendsPicker";
import {
  Avatar,
  Button,
  Card,
  DashedButton,
  FitText,
  Icon,
  type IconName,
  KEYBOARD_DISMISS_PROPS,
  KeyboardScrollView,
  Page,
  paperAt,
  Photo,
  RatingStampPicker,
  Sheet,
  Skeleton,
  Tape,
  Text,
  tiltFor,
  usePageContentStyle,
} from "../../components/ui";
import { useDjSearch, useEventSearch, useVenueSearch } from "../../lib/api/hooks";
import { useCurrentUser } from "../../lib/auth";
import { useApi } from "../../lib/api/client";
import { queryKeys } from "../../lib/api/queryKeys";
import type {
  CreateNightLogInput,
  Dj,
  EventSummary,
  NightLogResponse,
  Paginated,
  PlaceSuggestion,
  RAArea,
  RAEvent,
  RAEventMatch,
  RAEventsResponse,
  Review,
  SpotifyArtist,
  TagSummary,
  User,
  VenueSummary,
} from "../../lib/api/types";
import { parseDateInputValue, toDateInputValue } from "../../lib/format";
import { getCurrentPlace } from "../../lib/location";
import { ROUTES } from "../../lib/routes";

type ICreateDjInput = {
  name: string;
  bio?: string;
  genres?: string[];
  spotifyId?: string;
  imageUrl?: string;
};

// An already-saved DJ, or one (from Spotify or typed in by hand) that gets
// created when the night is saved.
type IArtistPick = { type: "existing"; dj: Dj } | { type: "new"; input: ICreateDjInput };

// One DJ in the night's lineup. Rating them is optional; an unrated DJ is
// still saved to the lineup.
type ILineupEntry = {
  key: string;
  pick: IArtistPick;
  rating?: number;
  reviewText: string;
  // Their review box is open.
  reviewing: boolean;
  // On the log. A lineup filled from Resident Advisor starts unticked
  // until you say which sets you caught; DJs you add yourself are caught.
  caught: boolean;
  fromRA?: boolean;
};

// An existing event ("Innervisions NY"), a new one created by name when the
// night is saved, or (none) a night with no name, just the venue.
type IEventPick =
  | { type: "existing"; event: EventSummary }
  | { type: "new"; name: string }
  | { type: "none" };

// An already-saved venue, a Google Places result (saved as a venue when the
// night is saved, in the billing session it was found in), or a name typed in
// by hand. Saved and Google venues already know their city.
type IVenuePick =
  | { type: "existing"; venue: VenueSummary }
  | { type: "place"; place: PlaceSuggestion; sessionToken: string }
  | { type: "typed"; name: string; city: string };

// Form fields as typed; turned into the POST /logs body on submit. rating,
// tags and reviewText are the review of the night as a whole.
type IReviewDraft = {
  // Unset until they name the night or pick "no name".
  eventPick?: IEventPick;
  venuePick?: IVenuePick;
  seenAt: string;
  isDay: boolean;
  isNight: boolean;
  rating?: number;
  tags: string[];
  reviewText: string;
  taggedUsers: User[];
};

// Either or both: a day into night party picks both.
const DAY_NIGHT_OPTIONS: { field: "isDay" | "isNight"; label: string; icon: IconName }[] = [
  { field: "isDay", label: "Day", icon: "sunny-outline" },
  { field: "isNight", label: "Night", icon: "moon-outline" },
];

// Which slot of the poster is being edited in a sheet.
type ISheet = "event" | "date" | "venue";

function emptyDraft(): IReviewDraft {
  return {
    seenAt: toDateInputValue(new Date()),
    isDay: false,
    isNight: true,
    tags: [],
    reviewText: "",
    taggedUsers: [],
  };
}

function artistPickName(pick: IArtistPick) {
  return pick.type === "existing" ? pick.dj.name : pick.input.name;
}

function artistPickKey(pick: IArtistPick) {
  if (pick.type === "existing") return `dj-${pick.dj.id}`;
  return pick.input.spotifyId ? `spotify-${pick.input.spotifyId}` : `new-${pick.input.name.toLowerCase()}`;
}

function eventPickName(pick: IEventPick | undefined) {
  if (pick?.type === "existing") return pick.event.name;
  if (pick?.type === "new") return pick.name;
  return undefined;
}

function nightsLogged(count: number) {
  return `${count} ${count === 1 ? "night" : "nights"} logged`;
}

const INPUT_CLASS =
  "rounded-md border-2 border-white/15 bg-zine-panel/90 focus:border-paper px-4 py-3 text-ink dark:text-paper placeholder:text-muted";


// Inputs drawn inside their own frame (search boxes, ruled paper) drop the
// browser's focus ring.
const NO_WEB_OUTLINE = Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : undefined;

// Fixed row height so the dropdown can cap itself at exactly five rows.
const RESULT_ROW_HEIGHT = 64;
const VISIBLE_RESULT_ROWS = 5;

// Small pixel-type label above a field ("YOUR RATING").
function FieldLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <Text className={`font-display text-base uppercase text-paper/60 ${className}`}>{children}</Text>;
}

// A search box for the sheets: white rule, magnifier, focused on open.
function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  // On web the modal's focus trap grabs focus as the sheet slides in, after
  // autoFocus has run; take it back once the slide has finished.
  const ref = useRef<TextInput>(null);
  useEffect(() => {
    const timer = setTimeout(() => ref.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, []);
  return (
    <View className="mx-4 mb-3 flex-row items-center gap-2 border-2 border-paper/80 bg-ink px-3">
      <Icon name="search" size={16} className="text-paper/70" />
      <TextInput
        ref={ref}
        autoFocus
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        autoCorrect={false}
        className="flex-1 py-3 text-paper placeholder:text-paper/40"
        style={NO_WEB_OUTLINE}
      />
    </View>
  );
}

// Multiline text on a ruled page: the lines sit behind the input at its line
// height.
const RULE_HEIGHT = 28;
function LinedInput({
  value,
  onChangeText,
  placeholder,
  lines = 4,
  autoFocus,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  lines?: number;
  autoFocus?: boolean;
}) {
  return (
    <View style={{ minHeight: RULE_HEIGHT * lines }}>
      {Array.from({ length: lines }, (_, i) => (
        <View
          key={i}
          pointerEvents="none"
          className="absolute left-0 right-0 border-b border-paper/15"
          style={{ top: RULE_HEIGHT * (i + 1) - 1 }}
        />
      ))}
      <TextInput
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        autoFocus={autoFocus}
        multiline
        textAlignVertical="top"
        className="p-0 text-base text-paper placeholder:text-paper/40"
        style={[NO_WEB_OUTLINE, { lineHeight: RULE_HEIGHT, minHeight: RULE_HEIGHT * lines }]}
      />
    </View>
  );
}

// One result in a sheet: something on the left (badge/icon), a pixel-type
// title, a small subtitle, and a check when it's the current pick.
function SheetRow({
  left,
  title,
  subtitle,
  selected = false,
  plain = false,
  onPress,
}: {
  left: ReactNode;
  title: string;
  subtitle?: string;
  selected?: boolean;
  // Body type instead of the uppercase display face (action rows).
  plain?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 border-b border-white/10 px-4 py-3 active:bg-zine-purple/20 ${
        selected ? "bg-zine-purple/20" : ""
      }`}
    >
      <View className="w-8 items-center">{left}</View>
      <View className="flex-1">
        <Text
          numberOfLines={1}
          className={plain ? "text-primary-dark" : "font-display text-lg uppercase leading-5 text-paper"}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text numberOfLines={1} className="text-xs text-paper/60">
            {subtitle}
          </Text>
        )}
      </View>
      {selected && <Icon name="checkmark" size={18} className="text-primary-dark" />}
    </Pressable>
  );
}

function SheetSectionLabel({ children }: { children: ReactNode }) {
  return <Text className="px-4 pb-1 pt-2 font-display text-sm uppercase text-paper/50">{children}</Text>;
}

function CircleIcon({ name }: { name: IconName }) {
  return (
    <View className="h-8 w-8 items-center justify-center rounded-full border border-paper/40">
      <Icon name={name} size={16} className="text-paper" />
    </View>
  );
}

function SheetSkeletonRow() {
  return (
    <View className="flex-row items-center gap-3 border-b border-white/10 px-4 py-3">
      <Skeleton className="h-8 w-8 rounded-full" />
      <View>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-1.5 h-3 w-24" />
      </View>
    </View>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// ---- Name the night ----------------------------------------------------

// Pick an event someone already logged ("Innervisions NY"), create one by
// name, or say the night had no name (the poster is then headed by the venue).
function EventSheet({
  current,
  onPick,
  onClose,
}: {
  current?: IEventPick;
  onPick: (pick: IEventPick) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(eventPickName(current) ?? "");
  const query = useDebouncedValue(value.trim(), 200);
  // An empty box lists the most-logged events.
  const { data, isFetching } = useEventSearch(query);
  const results = data ?? [];
  const typed = value.trim();
  const exactMatch = results.some((e) => e.name.toLowerCase() === typed.toLowerCase());

  // Closing with a name typed keeps it (the existing event, or a new one -
  // the server finds or creates events by name), rather than silently
  // dropping it and saving the night with no event.
  const close = () => {
    if (!typed || typed === eventPickName(current)) return onClose();
    const match = results.find((e) => e.name.toLowerCase() === typed.toLowerCase());
    onPick(match ? { type: "existing", event: match } : { type: "new", name: typed });
  };

  return (
    <Sheet title="Name the night" tag="Optional" onClose={close}>
      <SearchField value={value} onChangeText={setValue} placeholder="Innervisions NY, Boiler Room…" />
      <ScrollView className="shrink" {...KEYBOARD_DISMISS_PROPS}>
        {isFetching && !results.length && <SheetSkeletonRow />}
        {results.map((event, i) => (
          <SheetRow
            key={event.id}
            left={
              <View
                className={`h-8 w-8 items-center justify-center rounded-full ${i % 2 ? "bg-zine-red" : "bg-zine-purple"}`}
              >
                <Text className="font-numeric text-base leading-5 text-paper">{event.logCount}</Text>
              </View>
            }
            title={event.name}
            subtitle={nightsLogged(event.logCount)}
            selected={current?.type === "existing" && current.event.id === event.id}
            onPress={() => onPick({ type: "existing", event })}
          />
        ))}
        {!!typed && !exactMatch && (
          <SheetRow
            left={<CircleIcon name="add" />}
            title={`Create “${typed}” as a new event`}
            plain
            onPress={() => onPick({ type: "new", name: typed })}
          />
        )}
        <SheetRow
          left={<Icon name="ban-outline" size={22} className="text-paper/70" />}
          title="No name, just a night at the venue"
          subtitle="Leaves the poster headed by the venue"
          plain
          selected={current?.type === "none"}
          onPress={() => onPick({ type: "none" })}
        />
      </ScrollView>
    </Sheet>
  );
}

// ---- When was it? ------------------------------------------------------

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// "Sat 3 Oct", in the device locale's names.
function shortDayLabel(date: Date) {
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
  const month = date.toLocaleDateString(undefined, { month: "short" });
  return `${weekday} ${date.getDate()} ${month}`;
}

// Last night, then the most recent Fri, Sat and Sun before it (when most
// nights out happen), newest first.
function quickPicks(): { label: string; date: Date }[] {
  const yesterday = addDays(startOfToday(), -1);
  const picks = [{ label: "Last night", date: yesterday }];
  for (let back = 1; back <= 7; back++) {
    const date = addDays(yesterday, -back);
    if ([5, 6, 0].includes(date.getDay())) picks.push({ label: shortDayLabel(date), date });
  }
  return picks;
}

// Quick picks up top, a month grid below; future days are disabled. Tapping
// a day sets it and closes the sheet.
function DateSheet({
  value,
  onPick,
  onClose,
}: {
  value: string;
  onPick: (value: string) => void;
  onClose: () => void;
}) {
  const today = startOfToday();
  const selected = parseDateInputValue(value) ?? today;
  const [month, setMonth] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1));
  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
  // Monday-first grid: blanks before the 1st, then each day.
  const offset = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  const pick = (date: Date) => onPick(toDateInputValue(date));
  const shiftMonth = (by: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));

  return (
    <Sheet title="When was it?" onClose={onClose}>
      <ScrollView className="shrink" contentContainerClassName="px-4">
        <View className="mb-4 flex-row flex-wrap gap-2">
          {quickPicks().map(({ label, date }) => {
            const isSelected = toDateInputValue(date) === value;
            return (
              <Pressable
                key={label}
                onPress={() => pick(date)}
                className={`border-2 px-2 py-1 active:opacity-70 ${
                  isSelected ? "border-paper bg-paper" : "border-paper/80"
                }`}
              >
                <Text className={`font-display text-base uppercase leading-5 ${isSelected ? "text-ink" : "text-paper"}`}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="font-display text-xl uppercase text-paper">
            {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </Text>
          <View className="flex-row gap-4">
            <Pressable onPress={() => shiftMonth(-1)} hitSlop={8} accessibilityLabel="Previous month">
              <Icon name="chevron-back" size={20} className="text-paper" />
            </Pressable>
            <Pressable
              onPress={() => shiftMonth(1)}
              disabled={isCurrentMonth}
              hitSlop={8}
              accessibilityLabel="Next month"
              className={isCurrentMonth ? "opacity-30" : ""}
            >
              <Icon name="chevron-forward" size={20} className="text-paper" />
            </Pressable>
          </View>
        </View>
        <View className="flex-row flex-wrap">
          {WEEKDAYS.map((day) => (
            <View key={day} className="w-[14.28%] items-center py-1">
              <Text className="font-display text-sm uppercase text-paper/50">{day}</Text>
            </View>
          ))}
          {cells.map((date, i) => {
            if (!date) return <View key={`blank-${i}`} className="w-[14.28%]" />;
            const isFuture = date > today;
            const isSelected = toDateInputValue(date) === value;
            return (
              <View key={i} className="w-[14.28%] items-center py-1">
                <Pressable
                  onPress={() => pick(date)}
                  disabled={isFuture}
                  accessibilityLabel={date.toDateString()}
                  className={`h-9 w-9 items-center justify-center rounded-full ${
                    isSelected ? "border-2 border-paper bg-zine-purple" : "active:bg-white/10"
                  } ${isFuture ? "opacity-25" : ""}`}
                >
                  <Text className="font-numeric text-lg leading-5 text-paper">{date.getDate()}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Sheet>
  );
}

// ---- Where was it? -----------------------------------------------------

// Groups a venue search's Google Places calls (and the save of the picked
// place) into one billing session. Any URL-safe string up to 36 chars works.
function newPlacesSessionToken() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function venuePickName(pick: IVenuePick) {
  if (pick.type === "existing") return pick.venue.name;
  if (pick.type === "place") return pick.place.name;
  return pick.name;
}

function venuePickSubtitle(pick: IVenuePick) {
  if (pick.type === "existing") return pick.venue.city || pick.venue.address || "";
  if (pick.type === "place") return pick.place.secondaryText;
  return pick.city;
}

// Venues already on Beatboxd first (with how many nights are logged there),
// then Google Places results, then adding one by hand, which opens a city
// field in the sheet.
function VenueSheet({
  current,
  initialQuery = "",
  onPick,
  onClose,
}: {
  current?: IVenuePick;
  initialQuery?: string;
  onPick: (pick: IVenuePick) => void;
  onClose: () => void;
}) {
  const api = useApi();
  // A fresh sheet is a fresh search, so a new Google billing session.
  const [sessionToken] = useState(newPlacesSessionToken);
  const [value, setValue] = useState(initialQuery);
  const [typing, setTyping] = useState(current?.type === "typed" ? current : undefined);
  const query = value.trim();
  const enabled = query.length > 1;
  // Google bills per request, so wait for a pause in typing; the local
  // search is cheap and stays instant.
  const placesQuery = useDebouncedValue(query, 300);

  const { data: localResults, isFetching: isLocalFetching } = useVenueSearch(query, { suggest: true });
  const { data: placeResults, isFetching: isPlacesFetching } = useQuery({
    queryKey: queryKeys.venues.placesSearch(placesQuery),
    queryFn: () => api.get<PlaceSuggestion[]>("/venues/places-search", { q: placesQuery, sessionToken }),
    enabled: enabled && placesQuery.length > 1,
    // Place search is optional (503 when the server has no API key); fall
    // back to saved and typed venues instead of retrying.
    retry: false,
  });

  const locals = localResults ?? [];
  const savedPlaceIds = new Set(locals.flatMap((v) => (v.googlePlaceId ? [v.googlePlaceId] : [])));
  const places = enabled ? (placeResults ?? []).filter((place) => !savedPlaceIds.has(place.placeId)) : [];
  const placesLoading = enabled && (isPlacesFetching || placesQuery !== query);

  if (typing) {
    return (
      <Sheet title="Where was it?" tag="Required" tagClassName="text-danger-dark" onClose={onClose}>
        <View className="gap-3 px-4">
          <View>
            <FieldLabel className="mb-1">Venue</FieldLabel>
            <TextInput
              value={typing.name}
              onChangeText={(name) => setTyping({ ...typing, name })}
              className={INPUT_CLASS}
            />
          </View>
          <View>
            <FieldLabel className="mb-1">City</FieldLabel>
            <TextInput
              autoFocus
              placeholder="Berlin, Brooklyn…"
              value={typing.city}
              onChangeText={(city) => setTyping({ ...typing, city })}
              className={INPUT_CLASS}
            />
          </View>
          <Button
            disabled={!typing.name.trim()}
            onPress={() => onPick({ ...typing, name: typing.name.trim(), city: typing.city.trim() })}
            className="py-3"
          >
            <Text className="font-display text-xl uppercase text-paper">Use this venue</Text>
          </Button>
        </View>
      </Sheet>
    );
  }

  return (
    <Sheet title="Where was it?" tag="Required" tagClassName="text-danger-dark" onClose={onClose}>
      <SearchField value={value} onChangeText={setValue} placeholder="Club, warehouse, bar…" />
      <ScrollView className="shrink" {...KEYBOARD_DISMISS_PROPS}>
        {(!!locals.length || isLocalFetching) && <SheetSectionLabel>On Beatboxd</SheetSectionLabel>}
        {isLocalFetching && !locals.length && <SheetSkeletonRow />}
        {locals.map((venue) => (
          <SheetRow
            key={venue.id}
            left={<Icon name="location" size={20} className="text-primary-dark" />}
            title={venue.name}
            subtitle={[venue.city || venue.address, nightsLogged(venue.logCount)].filter(Boolean).join(" · ")}
            selected={current?.type === "existing" && current.venue.id === venue.id}
            onPress={() => onPick({ type: "existing", venue })}
          />
        ))}
        {(!!places.length || placesLoading) && <SheetSectionLabel>From Google Maps</SheetSectionLabel>}
        {places.map((place) => (
          <SheetRow
            key={place.placeId}
            left={<Icon name="location-outline" size={20} className="text-paper/70" />}
            title={place.name}
            subtitle={place.secondaryText}
            onPress={() => onPick({ type: "place", place, sessionToken })}
          />
        ))}
        {placesLoading && !places.length && <SheetSkeletonRow />}
        {enabled && (
          <SheetRow
            left={<CircleIcon name="add" />}
            title={`Add “${query}” by hand`}
            plain
            onPress={() => setTyping({ type: "typed", name: query, city: "" })}
          />
        )}
        {!!places.length && (
          <Text className="px-4 pt-2 text-right text-[10px] text-paper/40">Places results powered by Google</Text>
        )}
      </ScrollView>
    </Sheet>
  );
}

// ---- Find the night ----------------------------------------------------

// How far back the search looks: most logs are about last night.
const RANGES = [
  { days: 3, label: "Last 3 nights" },
  { days: 7, label: "Past week" },
] as const;

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
      <ScrollView className="shrink" {...KEYBOARD_DISMISS_PROPS}>
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
      className="mb-3 flex-row gap-3 border border-white/10 bg-zine-panel/90 p-2 active:opacity-80"
    >
      {event.flyerUrl ? (
        <Image source={{ uri: event.flyerUrl }} style={{ width: 56, height: 72 }} resizeMode="cover" />
      ) : (
        <View style={{ width: 56, height: 72 }} className={`items-center justify-center ${paper.tint === "accent" ? "bg-zine-red" : "bg-zine-purple"}`}>
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

// What the typed text could seed a blank poster as.
type IBlankSeed = { type: "event" | "dj" | "venue"; text: string } | undefined;

// Nothing on RA matched: start a poster with the typed text in a slot.
function NotOnTheWall({ query, onStart }: { query: string; onStart: (seed: IBlankSeed) => void }) {
  const options: { type: "event" | "dj" | "venue"; title: string; subtitle: string; icon: IconName; className: string }[] = [
    { type: "event", title: "The party's name", subtitle: "Then where, when, who played", icon: "albums-outline", className: "bg-zine-red" },
    { type: "dj", title: "A DJ", subtitle: "We'll check Spotify, then ask where you saw them", icon: "headset-outline", className: "bg-zine-purple" },
    { type: "venue", title: "A venue", subtitle: "Search Google Places for it", icon: "location-outline", className: "bg-[#0B090A] border border-white/15" },
  ];
  return (
    <View className="mt-2">
      <Text className="font-display text-2xl uppercase leading-6 text-paper">Not on the wall yet</Text>
      <Text className="mt-1 text-sm text-paper/70">
        Nothing on Resident Advisor matches &ldquo;{query}&rdquo;. Make the first poster for it.
      </Text>
      <Text className="mb-2 mt-4 font-display text-sm uppercase text-paper/50">&ldquo;{query}&rdquo; is…</Text>
      {options.map((o) => (
        <Pressable
          key={o.type}
          onPress={() => onStart({ type: o.type, text: query })}
          className={`mb-2 flex-row items-center gap-3 px-3 py-3 active:opacity-80 ${o.className}`}
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
  );
}

// The log tab opens here: one box over the nights listed on Resident
// Advisor near you lately (most logs are about last night), and parties
// already on Beatboxd. Picking an RA night fills the poster from it; a blank
// poster is always one tap away.
function FindTheNight({
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
  // no falls back to your latest log's city.
  const { data: here, isPending: locating } = useQuery({
    queryKey: queryKeys.location(),
    queryFn: () => getCurrentPlace().catch(() => null),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  useFocusEffect(
    useCallback(() => {
      queryClient.refetchQueries({ queryKey: queryKeys.location(), stale: true });
    }, [queryClient]),
  );
  // The device names the city where it can; on web the server geocodes the
  // coordinates.
  const where = area
    ? { areaId: area.id }
    : here
      ? here.city || here.region
        ? { city: here.city, region: here.region }
        : { lat: here.latitude.toFixed(3), lng: here.longitude.toFixed(3) }
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
        <FieldLabel className="mb-1 mt-2">Who, where, or what party?</FieldLabel>
        <View className="flex-row items-center gap-2 border-2 border-paper/80 bg-ink px-3">
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
        <View className="mb-4 mt-2 flex-row flex-wrap gap-2">
          <FilterChip
            icon="location-outline"
            label={
              shownArea?.name
                ? `Near ${shownArea.name}`
                : locating && !area
                  ? "Finding you…"
                  : "Pick your city"
            }
            onPress={() => setAreaSheet(true)}
          />
          <FilterChip
            icon="calendar-outline"
            label={range.label}
            onPress={() => setRangeIndex((i) => (i + 1) % RANGES.length)}
          />
        </View>

        {(isLoading || (locating && !area)) && (
          <View className="gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </View>
        )}
        {isError && !data && (
          <Text className="mb-3 text-paper/60">Couldn&apos;t reach Resident Advisor. Start a blank poster below.</Text>
        )}
        {!isLoading && !(locating && !area) && !shownArea && !query && (
          <Pressable onPress={() => setAreaSheet(true)} className="mb-4 border border-dashed border-paper/50 p-4 active:opacity-70">
            <Text className="font-display text-xl uppercase text-paper">Where do you go out?</Text>
            <Text className="text-sm text-paper/60">Pick your city to see the nights on Resident Advisor near you.</Text>
          </Pressable>
        )}

        {days.map((day, dayIndex) => (
          <View key={day}>
            <View className="mb-2 mt-2 flex-row items-end justify-between">
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
        ))}

        {!!matchingParties.length && (
          <View className="mt-2">
            <Text className="mb-2 font-display text-sm uppercase text-paper/50">Parties on Beatboxd</Text>
            {matchingParties.map((event, i) => (
              <Pressable
                key={event.id}
                onPress={() => onPickEvent(event)}
                className="mb-2 flex-row items-center gap-3 border border-white/10 bg-zine-panel/90 px-3 py-2 active:opacity-80"
              >
                <View className={`h-8 w-8 items-center justify-center rounded-full ${i % 2 ? "bg-zine-red" : "bg-zine-purple"}`}>
                  <Text className="font-numeric text-base leading-5 text-paper">{event.logCount}</Text>
                </View>
                <View className="flex-1">
                  <Text numberOfLines={1} className="font-display text-lg uppercase leading-5 text-paper">
                    {event.name}
                  </Text>
                  <Text className="text-xs text-paper/60">{nightsLogged(event.logCount)}</Text>
                </View>
                <View className="border border-paper/60 px-1">
                  <Text className="font-display text-xs uppercase leading-4 text-paper">Beatboxd</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {nothingFound ? (
          <NotOnTheWall query={query} onStart={onStartBlank} />
        ) : (
          <DashedButton
            label={query ? `Not here? Start a poster with “${query}”` : "Start a blank poster"}
            onPress={() => onStartBlank(query ? { type: "event", text: query } : undefined)}
            className="mb-6 mt-3 py-3"
          />
        )}
        {!!data?.events.length && (
          <Text className="mb-4 text-right text-[10px] text-paper/40">Listings from Resident Advisor</Text>
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

// The poster's starting point for an RA night, from its match: the party
// name (or none, headed by the venue), venue, day, day/night, and the lineup
// to tick off.
function draftFromRA(match: RAEventMatch): { draft: IReviewDraft; lineup: ILineupEntry[] } {
  const { venue } = match;
  const venuePick: IVenuePick | undefined = venue.venue
    ? { type: "existing", venue: venue.venue }
    : venue.place
      ? { type: "place", place: venue.place, sessionToken: venue.placeSessionToken }
      : venue.name
        ? { type: "typed", name: venue.name, city: venue.city }
        : undefined;
  const lineup: ILineupEntry[] = [];
  for (const artist of match.lineup) {
    const pick: IArtistPick = artist.dj
      ? { type: "existing", dj: artist.dj }
      : artist.spotify
        ? {
            type: "new",
            input: {
              name: artist.spotify.name,
              spotifyId: artist.spotify.spotifyId,
              imageUrl: artist.spotify.imageUrl ?? undefined,
              genres: artist.spotify.genres,
            },
          }
        : { type: "new", input: { name: artist.name } };
    const key = artistPickKey(pick);
    if (lineup.some((e) => e.key === key)) continue;
    lineup.push({ key, pick, reviewText: "", reviewing: false, caught: false, fromRA: true });
  }
  return {
    draft: {
      ...emptyDraft(),
      eventPick: match.eventName ? { type: "new", name: match.eventName } : { type: "none" },
      venuePick,
      // RA lists upcoming nights too; a night that hasn't happened can't be
      // logged, so those land on today for the person to fix.
      seenAt: match.seenAt > toDateInputValue(new Date()) ? toDateInputValue(new Date()) : match.seenAt,
      isDay: match.isDay,
      isNight: match.isNight || !match.isDay,
    },
    lineup,
  };
}

// "Who did you catch?": the RA lineup as checkboxes. Ticked DJs go on the
// log and get a card below to rate their set.
function CaughtChecklist({ lineup, onToggle }: { lineup: ILineupEntry[]; onToggle: (key: string) => void }) {
  return (
    <View className="border border-white/10 bg-zine-panel/90">
      {lineup.map((entry) => (
        <Pressable
          key={entry.key}
          onPress={() => onToggle(entry.key)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: entry.caught }}
          className="flex-row items-center gap-3 border-b border-white/10 px-3 py-3 active:bg-zine-purple/20"
        >
          <View
            className={`h-6 w-6 items-center justify-center border-2 ${
              entry.caught ? "border-primary-dark bg-zine-purple" : "border-paper/50"
            }`}
          >
            {entry.caught && <Icon name="checkmark" size={16} className="text-paper" />}
          </View>
          <Text numberOfLines={1} className="flex-1 font-display text-xl uppercase leading-6 text-paper">
            {artistPickName(entry.pick)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ---- The poster --------------------------------------------------------

// A filled slot's label carries a small pencil, so it reads as editable
// without the empty slots' dashed boxes.
function SlotLabel({ label, filled, className = "" }: { label: string; filled: boolean; className?: string }) {
  return (
    <View className={`flex-row items-center gap-1 ${className}`}>
      <Text className="font-display text-sm uppercase leading-4 text-paper/60">{label}</Text>
      {filled && <Icon name="pencil" size={10} className="text-paper/60" />}
    </View>
  );
}

// The night as a gig poster, and the form's top half: tap the name, the
// record (date) or the venue strip to edit it in a sheet, "+ who played" to
// add DJs below; day/night toggle right on it.
function NightPoster({
  draft,
  lineup,
  username,
  venueMissing,
  shake,
  onEdit,
  onAddDj,
  onToggle,
}: {
  draft: IReviewDraft;
  // Sets you didn't tick off an RA lineup show dimmed.
  lineup: { name: string; dim: boolean }[];
  username?: string;
  venueMissing: boolean;
  shake: Animated.Value;
  onEdit: (sheet: ISheet) => void;
  onAddDj: () => void;
  onToggle: (field: "isDay" | "isNight") => void;
}) {
  const date = parseDateInputValue(draft.seenAt) ?? new Date();
  const isToday = draft.seenAt === toDateInputValue(new Date());
  const eventName = eventPickName(draft.eventPick);
  const venueName = draft.venuePick && venuePickName(draft.venuePick);
  // A night with no name is headed by its venue.
  const headline = eventName ?? (draft.eventPick?.type === "none" ? venueName || "A night out" : undefined);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return (
    <Poster>
      <View className="flex-row items-center justify-between px-3 pt-3">
        <Text className="font-display text-sm uppercase tracking-widest text-paper/80">Beatboxd presents</Text>
        {!!username && <Text className="font-display text-sm uppercase text-stamp-red">@{username}</Text>}
      </View>

      <Pressable
        onPress={() => onEdit("date")}
        accessibilityLabel="Change the date"
        style={POSTER_RECORD_STYLE}
        className={`items-center justify-center active:opacity-80 ${
          isToday ? "border-2 border-dashed border-paper/50 bg-[#0B090A]" : "bg-zine-purple"
        }`}
      >
        <View className="flex-row items-center gap-0.5">
          <Text className="font-display text-sm uppercase leading-4 text-paper/80">
            {isToday ? "Today" : date.toLocaleDateString(undefined, { weekday: "short" })}
          </Text>
          {!isToday && <Icon name="pencil" size={9} className="text-paper/80" />}
        </View>
        <Text className="font-numeric text-3xl leading-8 text-paper">
          {day}.{month}
        </Text>
        <Text className="font-display text-xs leading-3 text-paper/80">{date.getFullYear()}</Text>
      </Pressable>

      <View className="px-3 pb-3 pt-24">
        <Pressable onPress={() => onEdit("event")} className="active:opacity-80" style={{ paddingRight: 72 }}>
          <SlotLabel label="Event · optional" filled={!!headline} className="mb-1" />
          {headline ? (
            <FitText fontSize={52} numberOfLines={4} className="text-paper" lastWordClassName="text-stamp-red">
              {headline}
            </FitText>
          ) : (
            <View className="self-start border border-dashed border-paper/40 px-2 py-1">
              <Text className="font-display text-5xl uppercase leading-[44px] text-paper/30">
                Name{"\n"}the night?
              </Text>
            </View>
          )}
        </Pressable>
        <Text className="mt-3 font-display text-lg uppercase leading-5 text-paper">
          {lineup.map(({ name, dim }) => (
            <Text key={name} className={`font-display ${dim ? "text-paper/35" : "text-paper"}`}>
              {name} ·{" "}
            </Text>
          ))}
          <Text onPress={onAddDj} className="font-display text-primary-dark" accessibilityRole="button">
            + Who played
          </Text>
        </Text>
      </View>

      <View className="flex-row border-t border-white/15">
        <Animated.View style={{ flex: 1, transform: [{ translateX: shake }] }}>
          <Pressable
            onPress={() => onEdit("venue")}
            className={`flex-1 border-r border-white/15 p-3 active:opacity-80 ${
              venueMissing ? "border-2 border-danger-dark" : ""
            }`}
          >
            <SlotLabel label="Venue" filled={!!venueName} />
            {draft.venuePick ? (
              <>
                <Text numberOfLines={2} className="mt-1 font-display text-xl uppercase leading-5 text-paper">
                  {venueName}
                </Text>
                {!!venuePickSubtitle(draft.venuePick) && (
                  <Text numberOfLines={1} className="text-xs text-paper/60">
                    {venuePickSubtitle(draft.venuePick)}
                  </Text>
                )}
              </>
            ) : (
              <View className="mt-1 self-start border border-dashed border-paper/40 px-2 py-1">
                <Text className="font-display text-xl uppercase leading-5 text-paper/30">Where?</Text>
                <Text className="text-xs text-danger-dark">Required</Text>
              </View>
            )}
          </Pressable>
        </Animated.View>
        <View className="p-3">
          <SlotLabel label="You went" filled={false} />
          <View className="mt-1.5 flex-row gap-1.5">
            {DAY_NIGHT_OPTIONS.map(({ field, label, icon }) => {
              const selected = draft[field];
              return (
                <Pressable
                  key={field}
                  onPress={() => onToggle(field)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  className={`flex-row items-center gap-1 border-2 px-2 py-1 active:opacity-80 ${
                    selected ? "border-paper bg-paper" : "border-paper/50"
                  }`}
                >
                  <Icon name={icon} size={12} className={selected ? "text-ink" : "text-paper"} />
                  <Text className={`font-display text-base uppercase leading-5 ${selected ? "text-ink" : "text-paper"}`}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Poster>
  );
}

// The cream slip pinned under the poster: what it'll be filed as.
function PosterCaption({ draft, username, fromRA }: { draft: IReviewDraft; username?: string; fromRA: boolean }) {
  const year = (parseDateInputValue(draft.seenAt) ?? new Date()).getFullYear();
  const eventName = eventPickName(draft.eventPick);
  const venueName = draft.venuePick && venuePickName(draft.venuePick);
  const started = !!draft.eventPick || !!draft.venuePick;
  const by = username ? `logged by @${username}` : undefined;
  return (
    <View className={`-mt-2 ml-6 self-start px-3 py-2 shadow-md shadow-black/60 ${POSTER_FRAME}`} style={{ transform: [{ rotate: "-1deg" }] }}>
      <Text className="font-display text-lg uppercase leading-5 text-ink">
        {eventName ?? venueName ?? "Untitled night"}, {year}
      </Text>
      {!!(venueName || by) && (
        <Text className="text-xs text-ink/70">{[eventName && venueName, by].filter(Boolean).join(" · ")}</Text>
      )}
      <Text className="text-xs text-zine-red">
        {fromRA
          ? "Filled from Resident Advisor · tap anything to fix it"
          : started
            ? "Tap anything on the poster to change it"
            : "Tap the poster to fill it in"}
      </Text>
    </View>
  );
}

// ---- Rate the sets -----------------------------------------------------

const COMMUNITY_ADDED_LABEL = "Added by the community";

// Spotify-backed artists are the norm; only call out community-added ones.
function djSubtitle(dj: Dj) {
  const genres = dj.genres?.join(", ") ?? "";
  if (dj.spotifyId) return genres;
  return genres ? `${COMMUNITY_ADDED_LABEL} · ${genres}` : COMMUNITY_ADDED_LABEL;
}

function ArtistResultRow({
  name,
  imageUrl,
  subtitle,
  onPress,
}: {
  name: string;
  imageUrl?: string | null;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{ height: RESULT_ROW_HEIGHT }}
      className="flex-row items-center gap-3 border-b border-white/10 px-4 active:bg-zine-purple/20"
    >
      <Avatar uri={imageUrl} name={name} size={40} />
      <View className="flex-1">
        <Text numberOfLines={1} className="font-display text-lg uppercase leading-5 text-paper">
          {name}
        </Text>
        {!!subtitle && (
          <Text numberOfLines={1} className="text-xs text-paper/60">
            {subtitle}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function ArtistSearchInput({
  value,
  onChangeText,
  onSelect,
  onCreate,
  onCancel,
  inputRef,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (pick: IArtistPick) => void;
  onCreate: () => void;
  onCancel: () => void;
  inputRef: Ref<TextInput>;
}) {
  const api = useApi();
  const query = value.trim();
  const enabled = query.length > 1;

  const { data: localResults, isFetching: isLocalFetching } = useDjSearch(query, { enabled });
  const { data: spotifyResults, isFetching: isSpotifyFetching } = useQuery({
    queryKey: queryKeys.djs.spotifySearch(query),
    queryFn: () => api.get<SpotifyArtist[]>("/djs/spotify-search", { q: query }),
    enabled,
  });

  // Spotify results lead, in Spotify's relevance order. One someone already
  // added resolves to its existing Beatboxd DJ (so it isn't listed twice or
  // re-created); community-added DJs with no Spotify match go last.
  const locals = localResults ?? [];
  const localBySpotifyId = new Map(locals.filter((dj) => dj.spotifyId).map((dj) => [dj.spotifyId, dj]));
  const rows: IArtistPick[] = (spotifyResults ?? []).map((artist) => {
    const dj = localBySpotifyId.get(artist.spotifyId);
    return dj ? { type: "existing", dj } : { type: "new", input: artist };
  });
  const listedDjIds = new Set(rows.flatMap((row) => (row.type === "existing" ? [row.dj.id] : [])));
  const remaining = locals.filter((dj) => !listedDjIds.has(dj.id));
  rows.push(
    ...remaining.filter((dj) => dj.spotifyId).map((dj) => ({ type: "existing" as const, dj })),
    ...remaining.filter((dj) => !dj.spotifyId).map((dj) => ({ type: "existing" as const, dj })),
  );
  // Skeleton only until the first rows land; once both searches settle with
  // nothing, say so instead of leaving an empty dropdown.
  const isFetching = isLocalFetching || isSpotifyFetching;
  const showSkeleton = isFetching && !rows.length;
  const showNoResults = !isFetching && !rows.length;

  return (
    <View>
      <View className="flex-row items-center gap-2 border-2 border-paper/80 bg-ink px-3">
        <Icon name="search" size={16} className="text-paper/70" />
        <TextInput
          ref={inputRef}
          autoFocus
          placeholder="Search Spotify for a DJ"
          value={value}
          onChangeText={onChangeText}
          className="flex-1 py-3 text-paper placeholder:text-paper/40"
          style={NO_WEB_OUTLINE}
        />
        <Pressable onPress={onCancel} hitSlop={8} accessibilityLabel="Stop adding a DJ">
          <Icon name="close" size={18} className="text-paper/70" />
        </Pressable>
      </View>
      {enabled && (
        <View className="border-x-2 border-b-2 border-paper/80 bg-zine-panel">
          <ScrollView
            style={{ maxHeight: RESULT_ROW_HEIGHT * VISIBLE_RESULT_ROWS }}
            nestedScrollEnabled
            {...KEYBOARD_DISMISS_PROPS}
          >
            {showSkeleton && (
              <View style={{ height: RESULT_ROW_HEIGHT }} className="flex-row items-center gap-3 border-b border-white/10 px-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <View>
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="mt-1.5 h-3 w-24" />
                </View>
              </View>
            )}
            {showNoResults && (
              <View style={{ height: RESULT_ROW_HEIGHT }} className="justify-center border-b border-white/10 px-4">
                <Text className="text-paper/60">No results found for &ldquo;{query}&rdquo;</Text>
              </View>
            )}
            {rows.map((row) =>
              row.type === "existing" ? (
                <ArtistResultRow
                  key={`local-${row.dj.id}`}
                  name={row.dj.name}
                  imageUrl={row.dj.imageUrl}
                  subtitle={djSubtitle(row.dj)}
                  onPress={() => onSelect(row)}
                />
              ) : (
                <ArtistResultRow
                  key={`spotify-${row.input.spotifyId}`}
                  name={row.input.name}
                  imageUrl={row.input.imageUrl}
                  subtitle={row.input.genres?.join(", ") ?? ""}
                  onPress={() => onSelect(row)}
                />
              ),
            )}
          </ScrollView>
          <SheetRow left={<CircleIcon name="add" />} title={`Create artist “${query}”`} plain onPress={onCreate} />
        </View>
      )}
    </View>
  );
}

// A DJ in the lineup, on purple or red paper: their name and photo, a row of
// stamps to rate the set, and a box for a review of it.
function LineupCard({
  entry,
  index,
  onChange,
  onEdit,
  onRemove,
}: {
  entry: ILineupEntry;
  index: number;
  onChange: (changes: Partial<ILineupEntry>) => void;
  onEdit?: () => void;
  onRemove: () => void;
}) {
  const { pick } = entry;
  const paper = paperAt(index);
  const name = artistPickName(pick);
  const imageUrl = pick.type === "existing" ? pick.dj.imageUrl : pick.input.imageUrl;
  const genres = (pick.type === "existing" ? pick.dj.genres : pick.input.genres) ?? [];
  const number = String(index + 1).padStart(2, "0");

  return (
    <Card tint={paper.tint} torn tilt={tiltFor(entry.key, 0.8)} className="pb-5">
      <Tape style={{ top: -10, left: 24 }} rotate={-4} />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <View className="flex-row items-center gap-3">
            <Text className={`font-display text-sm uppercase ${paper.inkClassName}`}>
              DJ {number}
              {!entry.rating && " · Tap a stamp to rate"}
            </Text>
            {onEdit && (
              <Pressable onPress={onEdit} hitSlop={8}>
                <Text className={`font-display text-sm uppercase underline ${paper.inkClassName}`}>Edit</Text>
              </Pressable>
            )}
          </View>
          <View className="mt-2">
            <FitText fontSize={40} numberOfLines={2} className="text-paper">
              {name}
            </FitText>
          </View>
          {!!genres.length && (
            <Text numberOfLines={1} className={`font-display text-sm uppercase ${paper.inkClassName}`}>
              {genres.slice(0, 2).join(" · ")}
            </Text>
          )}
        </View>
        <Photo
          uri={imageUrl}
          width={72}
          height={80}
          framed
          rotate={3}
          placeholderClassName={paper.photoPlaceholderClassName}
          silhouetteClassName={paper.photoSilhouetteClassName}
        />
      </View>

      <View className="mt-3 flex-row items-center justify-between border-t border-paper/25 pt-3">
        <RatingStampPicker value={entry.rating} onChange={(rating) => onChange({ rating })} size={40} />
        <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel={`Remove ${name}`}>
          <Icon name="close" size={18} className="text-paper/80" />
        </Pressable>
      </View>

      {entry.reviewing || !!entry.reviewText ? (
        <View className="mt-3 bg-black/20 p-3">
          <Text className={`mb-1 font-display text-sm uppercase ${paper.inkClassName}`}>Your review of {name}</Text>
          <LinedInput
            value={entry.reviewText}
            onChangeText={(reviewText) => onChange({ reviewText })}
            placeholder={`How was ${name}'s set?`}
            lines={3}
            autoFocus={entry.reviewing}
          />
        </View>
      ) : (
        <DashedButton
          label={`Review ${name}'s set`}
          icon="pencil"
          onPress={() => onChange({ reviewing: true })}
          className="mt-3 border-paper/70 bg-black/15 py-2"
        />
      )}
    </Card>
  );
}

function CreateArtistSheet({
  initial,
  onClose,
  onSave,
}: {
  initial: ICreateDjInput;
  onClose: () => void;
  onSave: (draft: ICreateDjInput) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [imageUrl, setImageUrl] = useState(initial.imageUrl);
  const [genresText, setGenresText] = useState(initial.genres?.join(", ") ?? "");
  const [bio, setBio] = useState(initial.bio);
  const [error, setError] = useState<string>();

  const trimmedImageUrl = imageUrl?.trim();

  const save = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Artist name is required");
      return;
    }
    if (trimmedImageUrl && !/^https?:\/\//i.test(trimmedImageUrl)) {
      setError("Image link should start with http:// or https://");
      return;
    }
    onSave({
      name: trimmedName,
      imageUrl: trimmedImageUrl || undefined,
      bio: bio?.trim() || undefined,
      genres: genresText
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean),
    });
  };

  return (
    <Sheet title="Add an artist" onClose={onClose}>
      <ScrollView className="shrink" contentContainerClassName="px-4" {...KEYBOARD_DISMISS_PROPS}>
        <Text className="mb-4 text-xs text-paper/60">They&apos;ll be added to Beatboxd when you save your log.</Text>
        <View className="mb-4 items-center">
          <Avatar uri={trimmedImageUrl || null} name={name || "?"} size={88} />
        </View>

        <FieldLabel className="mb-1">Name</FieldLabel>
        <TextInput placeholder="Artist name" value={name} onChangeText={setName} className={`mb-3 ${INPUT_CLASS}`} />

        <FieldLabel className="mb-1">Image link (optional)</FieldLabel>
        <TextInput
          placeholder="https://…"
          value={imageUrl}
          onChangeText={setImageUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          className={`mb-3 ${INPUT_CLASS}`}
        />

        <FieldLabel className="mb-1">Genres (optional)</FieldLabel>
        <TextInput
          placeholder="techno, house, dubstep"
          value={genresText}
          onChangeText={setGenresText}
          autoCapitalize="none"
          className={`mb-3 ${INPUT_CLASS}`}
        />

        <FieldLabel className="mb-1">Quick bio (optional)</FieldLabel>
        <TextInput
          placeholder="A sentence or two about them"
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={3}
          className={`min-h-20 ${INPUT_CLASS}`}
        />

        {!!error && <Text className="mt-3 text-danger-dark">{error}</Text>}
        <Button onPress={save} className="mt-4 py-3">
          <Text className="font-display text-xl uppercase text-paper">Add artist</Text>
        </Button>
      </ScrollView>
    </Sheet>
  );
}

// ---- The night overall -------------------------------------------------

// Mirrors the server's domain.NormalizeTag/NormalizeTags limits, so what
// the picker shows is what gets saved.
const MAX_TAG_LENGTH = 32;
const MAX_TAGS = 8;
const normalizeTag = (s: string) => s.trim().split(/\s+/).join(" ").toLowerCase();

// The default tags (most used first) as chips that stay put: tap one
// to fill it, again to clear it. "+ Tag" filters them as you type, or adds
// your own.
function TagPicker({
  tags,
  onAdd,
  onRemove,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const api = useApi();
  const [typing, setTyping] = useState(false);
  const [query, setQuery] = useState("");
  const typed = normalizeTag(query);

  const { data: library } = useQuery({
    queryKey: queryKeys.tags.list(""),
    queryFn: () => api.get<TagSummary[]>("/tags", { limit: 50 }),
  });

  const atMax = tags.length >= MAX_TAGS;
  // Only the curated defaults are offered; anything else is typed in.
  const names = (library ?? []).filter((t) => t.isDefault).map((t) => t.name);
  // Your own new tags sit after the library ones.
  const all = [...names, ...tags.filter((t) => !names.includes(t))];
  const shown = typed ? all.filter((t) => t.includes(typed)) : all;
  const canCreate = !!typed && !all.includes(typed);

  const toggle = (tag: string) => {
    if (tags.includes(tag)) return onRemove(tag);
    if (atMax || !tag) return;
    onAdd(tag);
    setQuery("");
  };

  return (
    <View>
      <View className="flex-row flex-wrap gap-2">
        {shown.map((tag) => {
          const selected = tags.includes(tag);
          const disabled = !selected && atMax;
          return (
            <Pressable
              key={tag}
              onPress={() => toggle(tag)}
              disabled={disabled}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected, disabled }}
              className={`border-2 px-1.5 py-0.5 active:opacity-80 ${
                selected ? "border-paper bg-paper" : "border-paper/50"
              } ${disabled ? "opacity-40" : ""}`}
            >
              <Text className={`font-display text-base uppercase leading-5 ${selected ? "text-ink" : "text-paper/80"}`}>
                {tag}
              </Text>
            </Pressable>
          );
        })}
        {!atMax && !typing && <DashedButton label="Tag" onPress={() => setTyping(true)} />}
      </View>
      {atMax && <Text className="mt-2 text-xs text-paper/60">That's the max of {MAX_TAGS} tags.</Text>}
      {!atMax && typing && (
        <View className="mt-2 flex-row items-center gap-2">
          <TextInput
            autoFocus
            placeholder="Filter tags or add your own"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => canCreate && toggle(typed)}
            maxLength={MAX_TAG_LENGTH}
            autoCapitalize="none"
            returnKeyType="done"
            submitBehavior="submit"
            className={`flex-1 ${INPUT_CLASS}`}
          />
          {canCreate && <DashedButton label={`Add "${typed}"`} onPress={() => toggle(typed)} className="py-2" />}
        </View>
      )}
    </View>
  );
}

// "01 RATE THE SETS ………… OPTIONAL"
function SectionHeading({
  number,
  title,
  numberClassName,
  aside = "Optional",
  asideClassName = "text-paper/50",
}: {
  number: string;
  title: string;
  numberClassName: string;
  aside?: string;
  asideClassName?: string;
}) {
  return (
    <View className="mb-4 mt-8 flex-row items-end justify-between">
      <View className="flex-row items-end gap-2">
        <Text className={`font-numeric text-4xl leading-9 ${numberClassName}`}>{number}</Text>
        <Text className="font-display text-2xl uppercase leading-7 text-paper">{title}</Text>
      </View>
      <Text className={`font-display text-sm uppercase ${asideClassName}`}>{aside}</Text>
    </View>
  );
}

export default function CreateReviewScreen() {
  const api = useApi();
  const queryClient = useQueryClient();
  const contentStyle = usePageContentStyle();
  const scrollRef = useRef<ScrollView>(null);
  const djInputRef = useRef<TextInput>(null);
  const shake = useRef(new Animated.Value(0)).current;

  const { me } = useCurrentUser();

  // The log opens on the search; picking a night (or a blank poster) moves
  // on to the poster form.
  const [stage, setStage] = useState<"search" | "form">("search");
  // The RA night being matched to DJs and a venue, while it loads.
  const [matchingId, setMatchingId] = useState<string>();
  const [fromRA, setFromRA] = useState(false);
  const [venueSheetQuery, setVenueSheetQuery] = useState("");
  const [sheet, setSheet] = useState<ISheet>();
  const [addingDj, setAddingDj] = useState(false);
  const [djQuery, setDjQuery] = useState("");
  const [lineup, setLineup] = useState<ILineupEntry[]>([]);
  // Open for a new artist (null) or to edit a hand-made one in the lineup (its key).
  const [artistSheet, setArtistSheet] = useState<{ editingKey: string | null }>();
  const [draft, setDraft] = useState<IReviewDraft>(emptyDraft);
  const [venueMissing, setVenueMissing] = useState(false);
  const [nightMissing, setNightMissing] = useState(false);
  const [error, setError] = useState<string>();

  const updateDraft = (changes: Partial<IReviewDraft>) => setDraft((prev) => ({ ...prev, ...changes }));
  const updateEntry = (key: string, changes: Partial<ILineupEntry>) =>
    setLineup((prev) => prev.map((e) => (e.key === key ? { ...e, ...changes } : e)));

  const addToLineup = (pick: IArtistPick) => {
    const key = artistPickKey(pick);
    // Adding a DJ who's on the RA lineup ticks them off.
    setLineup((prev) =>
      prev.some((e) => e.key === key)
        ? prev.map((e) => (e.key === key ? { ...e, caught: true } : e))
        : [...prev, { key, pick, reviewText: "", reviewing: false, caught: true }],
    );
    setDjQuery("");
    setAddingDj(false);
  };

  // "+ Who played" on the poster: open the DJ search below and focus it
  // (which scrolls it into view).
  const startAddingDj = () => {
    setAddingDj(true);
    requestAnimationFrame(() => djInputRef.current?.focus());
  };

  // A missing venue shakes the poster's venue strip and outlines it, rather
  // than an error under the form.
  const flagMissingVenue = () => {
    setVenueMissing(true);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    const useNativeDriver = Platform.OS !== "web";
    shake.setValue(0);
    Animated.sequence(
      [10, -10, 8, -8, 4, -4, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 50, useNativeDriver })),
    ).start();
  };

  const createDj = useMutation({
    mutationFn: (input: ICreateDjInput) => api.post<Dj>("/djs", input),
  });
  const createLog = useMutation({
    mutationFn: (input: CreateNightLogInput) => api.post<NightLogResponse>("/logs", input),
  });

  const resetForm = () => {
    setStage("search");
    setFromRA(false);
    setMatchingId(undefined);
    setSheet(undefined);
    setDjQuery("");
    setAddingDj(false);
    setLineup([]);
    setDraft(emptyDraft());
    setVenueMissing(false);
    setNightMissing(false);
    setError(undefined);
  };

  const pending = createDj.isPending || createLog.isPending;
  const caught = lineup.filter((e) => e.caught);
  const raLineup = lineup.filter((e) => e.fromRA);

  // Fill the poster from an RA night: its DJs matched to Beatboxd/Spotify
  // and its venue to Google Places by the server.
  const pickRAEvent = async (event: RAEvent) => {
    setMatchingId(event.id);
    try {
      const match = await queryClient.fetchQuery({
        queryKey: queryKeys.ra.match(event.id),
        queryFn: () => api.get<RAEventMatch>(`/ra/events/${event.id}/match`),
        staleTime: 5 * 60 * 1000,
      });
      const filled = draftFromRA(match);
      setDraft(filled.draft);
      setLineup(filled.lineup);
      setFromRA(true);
      setError(undefined);
      setStage("form");
    } catch (err: any) {
      // Still get them logging: a poster seeded with what RA listed.
      setDraft({
        ...emptyDraft(),
        venuePick: event.venue.name ? { type: "typed", name: event.venue.name, city: event.venue.area } : undefined,
      });
      setLineup([]);
      setError(`Couldn't fill this in from Resident Advisor (${err?.message ?? "try again"}). Fill in the rest below.`);
      setStage("form");
    } finally {
      setMatchingId(undefined);
    }
  };

  const startBlank = (seed?: IBlankSeed, eventPick?: IEventPick) => {
    setDraft({
      ...emptyDraft(),
      eventPick: eventPick ?? (seed?.type === "event" ? { type: "new", name: seed.text } : undefined),
    });
    setLineup([]);
    setFromRA(false);
    setError(undefined);
    setStage("form");
    if (seed?.type === "dj") {
      setDjQuery(seed.text);
      startAddingDj();
    } else if (seed?.type === "venue") {
      setVenueSheetQuery(seed.text);
      setSheet("venue");
    }
  };

  const onSubmit = async () => {
    setError(undefined);
    if (!me) {
      setError("Must be logged in to create a review");
      return;
    }
    const { eventPick, venuePick } = draft;
    if (!venuePick) {
      flagMissingVenue();
      return;
    }
    const seenAtDate = parseDateInputValue(draft.seenAt);
    if (!seenAtDate) {
      setError("Pick the date you went");
      return;
    }
    // The calendar disables future days; this is a backstop. YYYY-MM-DD
    // strings compare correctly as plain strings.
    if (draft.seenAt > toDateInputValue(new Date())) {
      setError("You can't log a set that hasn't happened yet");
      return;
    }
    if (!draft.isDay && !draft.isNight) {
      setError("Pick day, night, or both");
      return;
    }
    // Midday local time, so the stored instant reads back as the same
    // calendar day in any time zone (UTC midnight shows as the day before
    // across the Americas).
    seenAtDate.setHours(12);
    const where: Omit<CreateNightLogInput, "lineupDjIds" | "night" | "djReviews" | "tags" | "taggedUserIds"> = {
      ...(eventPick?.type === "existing"
        ? { eventId: eventPick.event.id }
        : eventPick?.type === "new"
          ? { eventName: eventPick.name }
          : {}),
      ...(venuePick.type === "existing"
        ? { venueId: venuePick.venue.id }
        : venuePick.type === "place"
          ? { placeId: venuePick.place.placeId, placeSessionToken: venuePick.sessionToken }
          : { venue: venuePick.name, city: venuePick.city || undefined }),
      seenAt: seenAtDate.toISOString(),
      isDay: draft.isDay,
      isNight: draft.isNight,
    };
    if (!draft.rating) {
      setNightMissing(true);
      setError("Rate the night overall");
      return;
    }
    const unratedWithText = caught.find((e) => !e.rating && e.reviewText.trim());
    if (unratedWithText) {
      setError(`Rate ${artistPickName(unratedWithText.pick)} to save what you wrote about them`);
      return;
    }

    try {
      // Save new artists first. Each one swaps into the lineup as saved, so
      // a retry after a failed log doesn't create it twice.
      const djsByKey = new Map<string, Dj>();
      for (const entry of caught) {
        if (entry.pick.type === "existing") {
          djsByKey.set(entry.key, entry.pick.dj);
          continue;
        }
        const dj = await createDj.mutateAsync(entry.pick.input);
        djsByKey.set(entry.key, dj);
        updateEntry(entry.key, { pick: { type: "existing", dj } });
      }
      const djFor = (entry: ILineupEntry) => djsByKey.get(entry.key)!;
      const rated = caught.filter((e) => !!e.rating);

      const result = await createLog.mutateAsync({
        ...where,
        lineupDjIds: caught.map((e) => djFor(e).id),
        night: { rating: draft.rating, reviewText: draft.reviewText.trim() || undefined },
        djReviews: rated.map((e) => ({
          djId: djFor(e).id,
          rating: e.rating!,
          reviewText: e.reviewText.trim() || undefined,
        })),
        tags: draft.tags,
        taggedUserIds: draft.taggedUsers.map((u) => u.id),
      });

      // The response only carries bare rows; seed the profile list and the
      // detail pages with full reviews so they render instantly instead of
      // waiting on a background refetch. Tags and friends land on the night
      // review, which comes first.
      const djsById = new Map([...djsByKey.values()].map((dj) => [dj.id, dj]));
      const log = {
        ...result.log,
        event: result.event,
        lineup: caught.map(djFor).sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())),
      };
      const fullReviews: Review[] = result.reviews.map((r, i) => {
        const carriesTags = i === 0;
        return {
          ...r,
          dj: r.djId ? djsById.get(r.djId) : undefined,
          log,
          user: me,
          taggedUsers: carriesTags ? draft.taggedUsers : [],
          tags: carriesTags ? [...draft.tags].sort() : [],
          likeCount: 0,
          commentCount: 0,
          isLikedByMe: false,
        };
      });
      const reviewsKey = queryKeys.reviews.byUser(me.username);
      // Profiles list newest-seen first, so slot them in by seenAt rather
      // than at the top (a set seen last month belongs below last week's).
      queryClient.setQueryData<Paginated<Review>>(reviewsKey, (old) => ({
        items: [...fullReviews, ...(old?.items ?? [])].sort(
          (a, b) => new Date(b.seenAt).getTime() - new Date(a.seenAt).getTime(),
        ),
        nextCursor: old?.nextCursor ?? null,
      }));
      for (const review of fullReviews) {
        queryClient.setQueryData<Review>(queryKeys.reviews.byId(review.id), review);
      }

      queryClient.invalidateQueries({ queryKey: reviewsKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.stats(me.username) });
      for (const dj of djsById.values()) {
        queryClient.invalidateQueries({ queryKey: queryKeys.djs.bySlug(dj.slug) });
      }
      if (result.event) queryClient.invalidateQueries({ queryKey: queryKeys.events.bySlug(result.event.slug) });
      if (result.log.venueId) queryClient.invalidateQueries({ queryKey: queryKeys.venues.byId(result.log.venueId) });
      queryClient.invalidateQueries({ queryKey: ["venues", "search"] });
      queryClient.invalidateQueries({ queryKey: ["events", "list"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.activity() });
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.popular() });
      queryClient.invalidateQueries({ queryKey: ["tags"] });

      // The tab stays mounted behind the review page, so clear it for the
      // next log rather than leaving this one's answers filled in on back.
      resetForm();
      // The night review comes first when there is one.
      router.push(ROUTES.REVIEW_DETAIL(result.reviews[0].id, { justLogged: true }));
    } catch (err: any) {
      setError(err?.message ?? "Could not save your review");
    }
  };

  const editingEntry = lineup.find((e) => e.key === artistSheet?.editingKey);

  if (stage === "search") {
    return (
      <Page title="Log a night" channel="CH 03 · Log">
        <FindTheNight
          matchingId={matchingId}
          onPickRA={pickRAEvent}
          onPickEvent={(event) => startBlank(undefined, { type: "existing", event })}
          onStartBlank={startBlank}
        />
      </Page>
    );
  }

  return (
    <Page title="Log a night" channel="CH 03 · Log">
      <KeyboardScrollView ref={scrollRef} contentContainerStyle={contentStyle}>
        <Pressable
          onPress={resetForm}
          hitSlop={8}
          accessibilityLabel="Back to search"
          className="mt-1 flex-row items-center gap-1 self-start active:opacity-70"
        >
          <Icon name="chevron-back" size={16} className="text-paper/70" />
          <Text className="font-display text-base uppercase text-paper/70">Search again</Text>
        </Pressable>
        <View className="mt-2">
          <NightPoster
            draft={draft}
            lineup={lineup.map((e) => ({ name: artistPickName(e.pick), dim: !e.caught }))}
            username={me?.username}
            venueMissing={venueMissing}
            shake={shake}
            onEdit={setSheet}
            onAddDj={startAddingDj}
            onToggle={(field) => updateDraft({ [field]: !draft[field] })}
          />
          <PosterCaption draft={draft} username={me?.username} fromRA={fromRA} />
        </View>

        {!!raLineup.length && (
          <>
            <SectionHeading
              number="01"
              title="Who did you catch?"
              numberClassName="text-stamp-red"
              aside={`${raLineup.filter((e) => e.caught).length} of ${raLineup.length}`}
            />
            <CaughtChecklist
              lineup={raLineup}
              onToggle={(key) => {
                const entry = lineup.find((e) => e.key === key);
                if (entry) updateEntry(key, { caught: !entry.caught });
              }}
            />
          </>
        )}

        <SectionHeading
          number={raLineup.length ? "02" : "01"}
          title={caught.length ? `Rate the ${caught.length === 1 ? "set" : `${caught.length} sets`}` : "Rate the sets"}
          numberClassName="text-primary-dark"
        />
        {caught.map((entry, index) => (
          <LineupCard
            key={entry.key}
            entry={entry}
            index={index}
            onChange={(changes) => updateEntry(entry.key, changes)}
            // Only hand-made artists (not yet saved, not from Spotify) are editable.
            onEdit={
              entry.pick.type === "new" && !entry.pick.input.spotifyId
                ? () => setArtistSheet({ editingKey: entry.key })
                : undefined
            }
            // An RA DJ is unticked (still listed above); one you added goes.
            onRemove={() =>
              entry.fromRA
                ? updateEntry(entry.key, { caught: false })
                : setLineup((prev) => prev.filter((e) => e.key !== entry.key))
            }
          />
        ))}
        {addingDj ? (
          <ArtistSearchInput
            inputRef={djInputRef}
            value={djQuery}
            onChangeText={setDjQuery}
            onSelect={addToLineup}
            onCreate={() => setArtistSheet({ editingKey: null })}
            onCancel={() => {
              setAddingDj(false);
              setDjQuery("");
            }}
          />
        ) : (
          <Pressable
            onPress={startAddingDj}
            className="flex-row items-center gap-2 border border-dashed border-paper/50 bg-black/30 px-4 py-3 active:opacity-70"
          >
            <Icon name="add" size={18} className="text-paper/80" />
            <Text className="font-display text-xl uppercase text-paper/80">Add a DJ: search Spotify</Text>
          </Pressable>
        )}

        <SectionHeading
          number={raLineup.length ? "03" : "02"}
          title="The night overall"
          numberClassName="text-stamp-red"
          aside="Required"
          asideClassName={nightMissing ? "text-danger-dark" : "text-paper/50"}
        />
        <Card tint="neutral" className="gap-5 pb-5">
          <Tape style={{ top: -10, right: 32 }} rotate={5} />
          <View>
            <FieldLabel className="mb-2">Your rating</FieldLabel>
            <RatingStampPicker
              value={draft.rating}
              onChange={(rating) => {
                updateDraft({ rating });
                setNightMissing(false);
              }}
              size={48}
            />
            {nightMissing && <Text className="mt-2 text-sm text-danger-dark">Rate the night to pin it up</Text>}
          </View>
          <View>
            <FieldLabel className="mb-2">What was it like</FieldLabel>
            <TagPicker
              tags={draft.tags}
              onAdd={(tag) => setDraft((prev) => ({ ...prev, tags: [...prev.tags, tag] }))}
              onRemove={(tag) => setDraft((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }))}
            />
          </View>
          <View>
            <FieldLabel className="mb-1">Review</FieldLabel>
            <LinedInput
              value={draft.reviewText}
              onChangeText={(reviewText) => updateDraft({ reviewText })}
              placeholder="How was the night?"
              lines={5}
            />
          </View>
          <View>
            <FieldLabel className="mb-2">Who you went with</FieldLabel>
            <TagFriendsPicker
              taggedUsers={draft.taggedUsers}
              onAdd={(user) => setDraft((prev) => ({ ...prev, taggedUsers: [...prev.taggedUsers, user] }))}
              onRemove={(userId) =>
                setDraft((prev) => ({ ...prev, taggedUsers: prev.taggedUsers.filter((u) => u.id !== userId) }))
              }
            />
          </View>
        </Card>

        {!!error && <Text className="mb-3 text-danger-dark">{error}</Text>}

        <Button disabled={pending} onPress={onSubmit} className="mt-2 flex-row gap-2 py-3">
          <Text className="font-display text-2xl uppercase text-paper">
            {pending ? "Pinning it up…" : "Pin it to the wall"}
          </Text>
          {!pending && <Icon name="arrow-forward" size={20} className="text-paper" />}
        </Button>
      </KeyboardScrollView>

      {sheet === "event" && (
        <EventSheet
          current={draft.eventPick}
          onPick={(eventPick) => {
            updateDraft({ eventPick });
            setSheet(undefined);
          }}
          onClose={() => setSheet(undefined)}
        />
      )}
      {sheet === "date" && (
        <DateSheet
          value={draft.seenAt}
          onPick={(seenAt) => {
            updateDraft({ seenAt });
            setSheet(undefined);
          }}
          onClose={() => setSheet(undefined)}
        />
      )}
      {sheet === "venue" && (
        <VenueSheet
          current={draft.venuePick}
          initialQuery={venueSheetQuery}
          onPick={(venuePick) => {
            updateDraft({ venuePick });
            setVenueMissing(false);
            setVenueSheetQuery("");
            setSheet(undefined);
          }}
          onClose={() => {
            setVenueSheetQuery("");
            setSheet(undefined);
          }}
        />
      )}
      {artistSheet && (
        <CreateArtistSheet
          initial={editingEntry?.pick.type === "new" ? editingEntry.pick.input : { name: djQuery.trim() }}
          onClose={() => setArtistSheet(undefined)}
          onSave={(input) => {
            if (editingEntry) {
              updateEntry(editingEntry.key, { pick: { type: "new", input } });
            } else {
              addToLineup({ type: "new", input });
            }
            setArtistSheet(undefined);
          }}
        />
      )}
    </Page>
  );
}
