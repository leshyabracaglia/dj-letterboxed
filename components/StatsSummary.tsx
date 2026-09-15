import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import { Text } from "./Text";

import { useApi } from "../lib/api/client";
import { queryKeys } from "../lib/api/queryKeys";
import type { UserStats } from "../lib/api/types";

export function StatsSummary({ username }: { username: string }) {
  const api = useApi();
  const { data: stats } = useQuery({
    queryKey: queryKeys.users.stats(username),
    queryFn: () => api.get<UserStats>(`/users/${username}/stats`),
  });

  if (!stats || stats.totalLogs === 0) return null;

  return (
    <View className="mt-3 border-t border-primary/15 pt-3">
      <View className="flex-row gap-6">
        <View>
          <Text className="text-lg font-bold text-primary dark:text-primary-dark">{stats.totalLogs}</Text>
          <Text className="text-xs text-muted">shows</Text>
        </View>
        <View>
          <Text className="text-lg font-bold text-primary dark:text-primary-dark">{stats.uniqueDjs}</Text>
          <Text className="text-xs text-muted">DJs</Text>
        </View>
      </View>

      {stats.topDjs.length > 0 ? (
        <View className="mt-3">
          <Text className="mb-1 text-sm font-semibold text-ink dark:text-paper">Top DJs</Text>
          {stats.topDjs.map((row) => (
            <Text key={row.dj.id} className="text-sm text-muted">
              {row.dj.name} · {row.logCount}
            </Text>
          ))}
        </View>
      ) : null}

      {stats.topVenues.length > 0 ? (
        <View className="mt-3">
          <Text className="mb-1 text-sm font-semibold text-ink dark:text-paper">Top venues</Text>
          {stats.topVenues.map((row) => (
            <Text key={row.venue} className="text-sm text-muted">
              {row.venue} · {row.logCount}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
