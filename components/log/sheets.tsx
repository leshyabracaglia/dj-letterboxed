import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";

import { Button, Icon, KEYBOARD_DISMISS_PROPS, Sheet, Text } from "../ui";
import { useApi } from "../../lib/api/client";
import { useEventSearch, useVenueSearch } from "../../lib/api/hooks";
import { queryKeys } from "../../lib/api/queryKeys";
import type { PlaceSuggestion } from "../../lib/api/types";
import { parseDateInputValue, toDateInputValue } from "../../lib/format";
import { useDebouncedValue } from "../../lib/utils";
import {
  addDays,
  eventPickName,
  type IEventPick,
  type IVenuePick,
  nightsLogged,
  shortDayLabel,
  startOfToday,
} from "./draft";
import {
  CircleIcon,
  FieldLabel,
  INPUT_CLASS,
  SearchField,
  SheetRow,
  SheetSectionLabel,
  SheetSkeletonRow,
} from "./fields";

// The poster's slots, edited in bottom sheets: the event, the date and the venue.

// ---- Name the night ----------------------------------------------------

// Pick an event someone already logged ("Innervisions NY"), create one by
// name, or say the night had no name (the poster is then headed by the venue).
export function EventSheet({
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
      <ScrollView className="mt-3 shrink" {...KEYBOARD_DISMISS_PROPS}>
        {isFetching && !results.length && <SheetSkeletonRow />}
        {results.map((event, i) => (
          <SheetRow
            key={event.id}
            left={
              <View
                className={`h-8 w-8 items-center justify-center rounded-full ${i % 2 ? "bg-zine-red" : "bg-zine-purple"}`}
              >
                <Text className="font-numeric text-base leading-5 text-paper">{event.reviewCount}</Text>
              </View>
            }
            title={event.name}
            subtitle={nightsLogged(event.reviewCount)}
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
export function DateSheet({
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
      <ScrollView className="shrink" contentContainerClassName="gap-4 px-4">
        <View className="flex-row flex-wrap gap-2">
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
                <Text
                  className={`font-display text-base uppercase leading-5 ${isSelected ? "text-ink" : "text-paper"}`}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
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

// Venues already on Beatboxd first (with how many nights are logged there),
// then Google Places results, then adding one by hand, which opens a city
// field in the sheet.
export function VenueSheet({
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
          <View className="gap-1">
            <FieldLabel>Venue</FieldLabel>
            <TextInput
              value={typing.name}
              onChangeText={(name) => setTyping({ ...typing, name })}
              className={INPUT_CLASS}
            />
          </View>
          <View className="gap-1">
            <FieldLabel>City</FieldLabel>
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
      <ScrollView className="mt-3 shrink" {...KEYBOARD_DISMISS_PROPS}>
        {(!!locals.length || isLocalFetching) && <SheetSectionLabel>On Beatboxd</SheetSectionLabel>}
        {isLocalFetching && !locals.length && <SheetSkeletonRow />}
        {locals.map((venue) => (
          <SheetRow
            key={venue.id}
            left={<Icon name="location" size={20} className="text-primary-dark" />}
            title={venue.name}
            subtitle={[venue.city || venue.address, nightsLogged(venue.reviewCount)].filter(Boolean).join(" · ")}
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
