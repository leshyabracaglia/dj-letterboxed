import type { ReactNode } from "react";
import { View } from "react-native";
import { Skeleton, Text } from "./ui";

import { useUserStats } from "../lib/api/hooks";
import type { UserStats } from "../lib/api/types";
import { DjAvatarRow } from "./DjAvatarRow";

// The user's 3 most-reviewed DJs with how many times they've seen each.
function MostSeenDjs({ topDjs }: { topDjs: UserStats["topDjs"] }) {
  return (
    <View className="mt-3">
      <Text className="font-display text-xl uppercase text-paper/85">Most seen</Text>
      <View className="mt-2">
        <DjAvatarRow
          items={topDjs.map(({ dj, reviewCount }) => ({
            dj,
            caption: (
              <Text className="font-display text-sm uppercase text-paper/60">
                seen <Text className="font-numeric text-sm text-paper">{reviewCount}</Text>×
              </Text>
            ),
          }))}
        />
      </View>
    </View>
  );
}

/** Profile stats below the counts row: most-seen DJs and top venues. The
 * optional `favorites` slot (FavoritesShowcase, currently unused) renders
 * above them. */
export function StatsSummary({ username, favorites }: { username: string; favorites?: ReactNode }) {
  const { data: stats } = useUserStats(username);

  if (!stats) {
    return (
      <View className="mt-3 border-t border-white/10 pt-3">
        <Skeleton className="h-4 w-20" />
        <View className="mt-2 flex-row gap-3">
          <Skeleton className="h-14 w-14 rounded-full" />
          <Skeleton className="h-14 w-14 rounded-full" />
          <Skeleton className="h-14 w-14 rounded-full" />
        </View>
      </View>
    );
  }
  if (!favorites && !stats.topDjs.length && !stats.topVenues.length) return null;

  return (
    <View className="mt-3 border-t border-white/10 pt-3">
      {favorites}

      {!!stats.topDjs.length && <MostSeenDjs topDjs={stats.topDjs} />}

      {!!stats.topVenues.length && (
        <View className="mt-3">
          <Text className="mb-1 font-display text-xl uppercase text-paper/85">Top venues</Text>
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
