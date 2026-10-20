import { type ReactNode, useState } from "react";
import { Pressable, View } from "react-native";
import { Avatar, Skeleton, Stamp, Text } from "./ui";
import { router } from "expo-router";

import { useUserStats } from "@/lib/api/hooks";
import { plural } from "@/lib/format";
import type { UserStats } from "@/lib/api/types";
import { ROUTES } from "@/lib/routes";

const DJ_RANKING_TYPES = {
  RECENT: "recent",
  MOST: "most",
};

type DjRankingType = (typeof DJ_RANKING_TYPES)[keyof typeof DJ_RANKING_TYPES];

const DJ_RANKING_TYPE_OPTIONS: { value: DjRankingType; label: string }[] = [
  { value: DJ_RANKING_TYPES.RECENT, label: "Recently seen" },
  { value: DJ_RANKING_TYPES.MOST, label: "Most seen" },
];

// "Sep 14", in the device's locale.
function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function SeenDjs({ stats }: { stats: UserStats }) {
  const [selectedRankingType, setSelectedRankingType] = useState<DjRankingType>(DJ_RANKING_TYPES.RECENT);

  return (
    <View>
      <View className="flex-row gap-4">
        {DJ_RANKING_TYPE_OPTIONS.map((rankOption) => {
          const isSelected = rankOption.value === selectedRankingType;
          return (
            <Pressable
              key={rankOption.value}
              onPress={() => setSelectedRankingType(rankOption.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              hitSlop={6}
            >
              <Text variant="display" className={`text-xl ${isSelected ? "text-paper underline" : "text-paper/40"}`}>
                {rankOption.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View className="mt-2 flex-row flex-wrap gap-3">
        {selectedRankingType === DJ_RANKING_TYPES.RECENT &&
          stats.recentDjs.map(({ dj, lastSeenAt }) => (
            <Pressable key={dj.id} onPress={() => router.push(ROUTES.DJ(dj.slug))} className="w-20 items-center">
              <Avatar uri={dj.imageUrl} name={dj.name} size={56} />
              <Text variant="display" className="mt-1 text-center text-base leading-5 text-paper" numberOfLines={1}>
                {dj.name}
              </Text>
              <Text variant="display" className="text-sm text-paper/60">
                {shortDate(lastSeenAt)}
              </Text>
            </Pressable>
          ))}
        {selectedRankingType === DJ_RANKING_TYPES.MOST &&
          stats.topDjs.map(({ dj, timesSeen }) => (
            <Pressable key={dj.id} onPress={() => router.push(ROUTES.DJ(dj.slug))} className="w-20 items-center">
              <Avatar uri={dj.imageUrl} name={dj.name} size={56} />
              <Text variant="display" className="mt-1 text-center text-base leading-5 text-paper" numberOfLines={1}>
                {dj.name}
              </Text>
              <Text variant="display" className="text-sm text-paper/60">
                seen <Text className="font-numeric text-sm text-paper">{timesSeen}</Text>
              </Text>
            </Pressable>
          ))}
      </View>
    </View>
  );
}

// How many passport stamps show before "+N".
const PASSPORT_SHOWN = 8;
const PASSPORT_STAMP_SIZE = 76;
// Stamps land a little crooked, each its own way.
const PASSPORT_TILTS = [-8, 5, -3, 9, -6, 3];

/** A venue's name for the middle of its stamp, a word to a line (three at
 * most). */
function stampLines(name: string): string[] {
  const words = name.split(/\s+/).filter(Boolean);
  return words.length <= 3 ? words : [...words.slice(0, 2), words.slice(2).join(" ")];
}

// Every club they've logged a night at, as stamps in a passport, first visit
// first.
function Passport({ stamps }: { stamps: UserStats["passport"] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? stamps : stamps.slice(0, PASSPORT_SHOWN);
  const hidden = stamps.length - shown.length;
  const cities = new Set(stamps.map((stamp) => stamp.city?.split(",")[0].trim().toLowerCase()).filter(Boolean));
  return (
    <View>
      <Text variant="display" className="text-xl text-paper/85">
        Passport · {plural(stamps.length, "club")}
        {!!cities.size && ` · ${cities.size} ${cities.size === 1 ? "city" : "cities"}`}
      </Text>
      <View className="mt-2 flex-row flex-wrap gap-2">
        {shown.map((stamp, i) => (
          <Pressable
            key={stamp.venueId}
            onPress={() => router.push(ROUTES.VENUE(stamp.venueId))}
            accessibilityRole="link"
            className="active:opacity-80"
          >
            <Stamp
              label={stampLines(stamp.name)}
              rim={`${stamp.city?.split(",")[0] ?? "BEATBOXD"} · `}
              size={PASSPORT_STAMP_SIZE}
              color={i % 2 ? "purple" : "red"}
              rotate={PASSPORT_TILTS[i % PASSPORT_TILTS.length]}
              accessibilityLabel={`${stamp.name}: ${plural(stamp.nights, "night")}`}
            />
          </Pressable>
        ))}
        {!!hidden && (
          <Pressable
            onPress={() => setExpanded(true)}
            accessibilityRole="button"
            accessibilityLabel={`Show ${plural(hidden, "more club")}`}
            className="active:opacity-80"
          >
            <Stamp
              label={`+${hidden}`}
              size={PASSPORT_STAMP_SIZE}
              color="purple"
              rotate={0}
              accessibilityLabel={`${hidden} more`}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Profile stats below the counts row: recently/most seen DJs and the
 * passport of venues they've been to. The
 * optional `favorites` slot (FavoritesShowcase, currently unused) renders
 * above them. */
export function StatsSummary({ username, favorites }: { username: string; favorites?: ReactNode }) {
  const { data: stats } = useUserStats(username);

  if (!stats) {
    return (
      <View className="border-t border-white/10 pt-3">
        <Skeleton className="h-4 w-20" />
        <View className="mt-2 flex-row gap-3">
          <Skeleton className="h-14 w-14 rounded-full" />
          <Skeleton className="h-14 w-14 rounded-full" />
          <Skeleton className="h-14 w-14 rounded-full" />
        </View>
      </View>
    );
  }

  const hasDjs = !!stats.recentDjs?.length || !!stats.topDjs.length;
  if (!favorites && !hasDjs && !stats.passport.length) return null;

  return (
    <View className="border-t border-white/10 pt-3">
      {favorites}

      {hasDjs && (
        <View className="mt-3">
          <SeenDjs stats={stats} />
        </View>
      )}

      {!!stats.passport.length && (
        <View className="mt-3">
          <Passport stamps={stats.passport} />
        </View>
      )}
    </View>
  );
}
