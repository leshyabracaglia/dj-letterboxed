import { type ReactNode, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Avatar, Skeleton, Text } from "./ui";
import { router } from "expo-router";

import { useUserStats } from "../lib/api/hooks";
import type { UserStats } from "../lib/api/types";
import { ROUTES } from "@/lib/routes";

const DJ_RANKING_TYPES = {
  RECENT: 'recent',
  MOST: 'most'
}

type DjRankingType = typeof DJ_RANKING_TYPES[keyof typeof DJ_RANKING_TYPES];

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
              <Text className={`font-display text-xl uppercase ${isSelected ? "text-paper underline" : "text-paper/40"}`}>
                {rankOption.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View className="mt-2 flex-row flex-wrap gap-3">
      {selectedRankingType === DJ_RANKING_TYPES.RECENT && (
        stats.recentDjs.map(({ dj, lastSeenAt }) => (
          <Pressable key={dj.id} onPress={() => router.push(ROUTES.DJ(dj.slug))} className="w-20 items-center">
            <Avatar uri={dj.imageUrl} name={dj.name} size={56} />
            <Text className="mt-1 text-center font-display text-base uppercase leading-5 text-paper" numberOfLines={1}>
              {dj.name}
            </Text>
            <Text className="font-display text-sm uppercase text-paper/60">{shortDate(lastSeenAt)}</Text>
          </Pressable>
        ))
      )}
      {selectedRankingType === DJ_RANKING_TYPES.MOST && (
        stats.topDjs.map(({ dj, timesSeen }) => (
          <Pressable key={dj.id} onPress={() => router.push(ROUTES.DJ(dj.slug))} className="w-20 items-center">
            <Avatar uri={dj.imageUrl} name={dj.name} size={56} />
            <Text className="mt-1 text-center font-display text-base uppercase leading-5 text-paper" numberOfLines={1}>
              {dj.name}
            </Text>
            <Text className="font-display text-sm uppercase text-paper/60">seen <Text className="font-numeric text-sm text-paper">{timesSeen}</Text></Text>
          </Pressable>
        ))
      )
      }
    </View>
    </View>
  );
}

/** Profile stats below the counts row: recently/most seen DJs and top venues. The
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
  if (!favorites && !hasDjs && !stats.topVenues.length) return null;

  return (
    <View className="border-t border-white/10 pt-3">
      {favorites}

      {hasDjs && (
        <View className="mt-3" >
          <SeenDjs stats={stats} />
        </View>
      )}

      {!!stats.topVenues.length && (
        <View className="mt-3 gap-1">
          <Text className="font-display text-xl uppercase text-paper/85">Top venues</Text>
          {stats.topVenues.map((row) => (
            <Text key={row.venue} className="font-display text-lg uppercase text-paper/70">
              {row.venue} · <Text className="font-numeric text-lg text-paper">{row.reviewCount}</Text>
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
