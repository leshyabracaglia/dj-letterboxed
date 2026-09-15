import { Text, View } from "react-native";

import type { Dj, Event, Review, User } from "../lib/api/types";
import { formatDate } from "../lib/format";
import { ROUTES } from "../lib/routes";
import { Card } from "./Card";
import { CrowdVibeBadge } from "./CrowdVibeBadge";
import { RatingStars } from "./RatingStars";

export function ReviewCard({
  log,
}: {
  log: Review & { user?: User; dj?: Dj; event?: Event | null; isPopular?: boolean };
}) {
  return (
    <Card href={ROUTES.LOG_DETAIL(log.id)}>
      {log.isPopular ? (
        <View className="mb-2 self-start rounded-full bg-amber-100 px-2 py-0.5">
          <Text className="text-xs font-semibold text-amber-700">🔥 Popular</Text>
        </View>
      ) : null}
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-ink">{log.dj?.name ?? "Unknown DJ"}</Text>
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
      <Text className="mt-1 text-xs text-muted">{formatDate(log.seenAt)}</Text>
      {log.reviewText ? (
        <Text className="mt-2 text-sm text-ink" numberOfLines={3}>
          {log.reviewText}
        </Text>
      ) : null}
      <View className="mt-2">
        <CrowdVibeBadge vibe={log.crowdVibe} />
      </View>
    </Card>
  );
}
