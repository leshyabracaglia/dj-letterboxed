import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";

import { useTRPC } from "../hooks/trpc";

export function StatsSummary({ username }: { username: string }) {
  const trpc = useTRPC();
  const { data: stats } = useQuery(trpc.users.getStats.queryOptions({ username }));

  if (!stats || stats.totalLogs === 0) return null;

  return (
    <View className="mt-3 border-t border-muted/20 pt-3">
      <View className="flex-row gap-6">
        <View>
          <Text className="text-lg font-bold text-ink">{stats.totalLogs}</Text>
          <Text className="text-xs text-muted">shows</Text>
        </View>
        <View>
          <Text className="text-lg font-bold text-ink">{stats.uniqueDjs}</Text>
          <Text className="text-xs text-muted">DJs</Text>
        </View>
      </View>

      {stats.topDjs.length > 0 ? (
        <View className="mt-3">
          <Text className="mb-1 text-sm font-semibold text-ink">Top DJs</Text>
          {stats.topDjs.map((row) => (
            <Text key={row.dj.id} className="text-sm text-muted">
              {row.dj.name} · {row.logCount}
            </Text>
          ))}
        </View>
      ) : null}

      {stats.topVenues.length > 0 ? (
        <View className="mt-3">
          <Text className="mb-1 text-sm font-semibold text-ink">Top venues</Text>
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
