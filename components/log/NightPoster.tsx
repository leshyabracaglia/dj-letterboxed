import { Animated, Pressable, View } from "react-native";

import { Poster, POSTER_FRAME, POSTER_RECORD_STYLE } from "../Poster";
import { FitText, Icon, type IconName, Text } from "../ui";
import { parseDateInputValue, toDateInputValue } from "../../lib/format";
import { eventPickName, type IReviewDraft, type ISheet, venuePickName, venuePickSubtitle } from "./draft";

// Either or both: a day into night party picks both.
const DAY_NIGHT_OPTIONS: { field: "isDay" | "isNight"; label: string; icon: IconName }[] = [
  { field: "isDay", label: "Day", icon: "sunny-outline" },
  { field: "isNight", label: "Night", icon: "moon-outline" },
];

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
export function NightPoster({
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
        <Pressable onPress={() => onEdit("event")} className="gap-1 active:opacity-80" style={{ paddingRight: 72 }}>
          <SlotLabel label="Event · optional" filled={!!headline} />
          {headline ? (
            <FitText fontSize={52} numberOfLines={4} className="text-paper" lastWordClassName="text-stamp-red">
              {headline}
            </FitText>
          ) : (
            <View className="self-start border border-dashed border-paper/40 px-2 py-1">
              <Text className="font-display text-5xl uppercase leading-[44px] text-paper/30">Name{"\n"}the night?</Text>
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
                  <Text
                    className={`font-display text-base uppercase leading-5 ${selected ? "text-ink" : "text-paper"}`}
                  >
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
// `filledFrom` names where a filled-in poster came from ("Resident Advisor").
export function PosterCaption({
  draft,
  username,
  filledFrom,
}: {
  draft: IReviewDraft;
  username?: string;
  filledFrom?: string;
}) {
  const year = (parseDateInputValue(draft.seenAt) ?? new Date()).getFullYear();
  const eventName = eventPickName(draft.eventPick);
  const venueName = draft.venuePick && venuePickName(draft.venuePick);
  const started = !!draft.eventPick || !!draft.venuePick;
  const by = username ? `logged by @${username}` : undefined;
  return (
    <View
      className={`ml-6 self-start px-3 py-2 shadow-md shadow-black/60 ${POSTER_FRAME}`}
      style={{ transform: [{ rotate: "-1deg" }] }}
    >
      <Text className="font-display text-lg uppercase leading-5 text-ink">
        {eventName ?? venueName ?? "Untitled night"}, {year}
      </Text>
      {!!(venueName || by) && (
        <Text className="text-xs text-ink/70">{[eventName && venueName, by].filter(Boolean).join(" · ")}</Text>
      )}
      <Text className="text-xs text-zine-red">
        {filledFrom
          ? `Filled from ${filledFrom} · tap anything to fix it`
          : started
            ? "Tap anything on the poster to change it"
            : "Tap the poster to fill it in"}
      </Text>
    </View>
  );
}
