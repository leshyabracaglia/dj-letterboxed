import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { Dj, Event, Log, User } from "../lib/db/schema";
import { CrowdVibeBadge } from "./CrowdVibeBadge";
import { RatingStars } from "./RatingStars";

export function LogCard({
  log,
}: {
  log: Log & { user?: User; dj?: Dj; event?: Event | null };
}) {
  return (
    <Link href={`/log/${log.id}`} asChild>
      <Pressable className="mb-3 rounded-xl border border-muted/20 bg-white p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-semibold text-ink">
            {log.dj?.name ?? "Unknown DJ"}
          </Text>
          <RatingStars value={log.ratingHalfStars} size={14} />
        </View>
        {log.user ? (
          <Text className="mt-1 text-xs text-muted">
            logged by {log.user.displayName ?? log.user.username}
          </Text>
        ) : null}
        {log.event ? (
          <Text className="mt-1 text-sm text-muted">
            {log.event.name} · {log.event.venue}
          </Text>
        ) : null}
        <Text className="mt-1 text-xs text-muted">
          {new Date(log.seenAt).toLocaleDateString()}
        </Text>
        {log.reviewText ? (
          <Text className="mt-2 text-sm text-ink" numberOfLines={3}>
            {log.reviewText}
          </Text>
        ) : null}
        <View className="mt-2">
          <CrowdVibeBadge vibe={log.crowdVibe} />
        </View>
      </Pressable>
    </Link>
  );
}
