import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import { Skeleton, Text } from "./ui";

import { useApi } from "../lib/api/client";
import { queryKeys } from "../lib/api/queryKeys";
import type { UserStats } from "../lib/api/types";
import { DjAvatarRow } from "./DjAvatarRow";

// The user's 3 most-reviewed DJs with how many times they've seen each,
// laid out like FavoritesShowcase's row so the two read as a pair.
function MostSeenDjs({ topDjs }: { topDjs: UserStats["topDjs"] }) {
  return (
    <View className="mt-3">
      <Text className="text-sm font-semibold text-ink dark:text-paper">Most seen</Text>
      <View className="mt-2">
        <DjAvatarRow
          items={topDjs.map(({ dj, reviewCount }) => ({
            dj,
            caption: (
              <Text className="text-xs text-muted">
                seen <Text className="font-numeric text-sm text-muted">{reviewCount}</Text>×
              </Text>
            ),
          }))}
        />
      </View>
    </View>
  );
}

export function StatsSummary({ username }: { username: string }) {
  const api = useApi();
  const { data: stats } = useQuery({
    queryKey: queryKeys.users.stats(username),
    queryFn: () => api.get<UserStats>(`/users/${username}/stats`),
  });

  if (!stats) {
    return (
      <View className="mt-3 flex-row gap-6 border-t border-primary/15 pt-3">
        <View>
          <Skeleton className="h-8 w-10" />
          <Skeleton className="mt-1.5 h-3 w-10" />
        </View>
        <View>
          <Skeleton className="h-8 w-10" />
          <Skeleton className="mt-1.5 h-3 w-10" />
        </View>
      </View>
    );
  }
  if (stats.totalReviews === 0) return null;

  return (
    <View className="mt-3 border-t border-primary/15 pt-3">
      <View className="flex-row gap-6">
        <View>
          <Text className="font-numeric text-3xl text-primary dark:text-primary-dark">
            {stats.totalReviews}
          </Text>
          <Text className="text-xs text-muted">shows</Text>
        </View>
        <View>
          <Text className="font-numeric text-3xl text-primary dark:text-primary-dark">
            {stats.uniqueDjs}
          </Text>
          <Text className="text-xs text-muted">DJs</Text>
        </View>
      </View>

      {!!stats.topDjs.length && <MostSeenDjs topDjs={stats.topDjs} />}

      {!!stats.topVenues.length && (
        <View className="mt-3">
          <Text className="mb-1 text-sm font-semibold text-ink dark:text-paper">Top venues</Text>
          {stats.topVenues.map((row) => (
            <Text key={row.venue} className="text-sm text-muted">
              {row.venue} · <Text className="font-numeric text-base text-muted">{row.reviewCount}</Text>
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
