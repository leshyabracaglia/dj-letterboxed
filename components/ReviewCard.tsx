import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Text } from "./Text";

import type { Dj, Event, Review, User } from "../lib/api/types";
import { formatDate } from "../lib/format";
import { ROUTES } from "../lib/routes";
import { Avatar } from "./Avatar";
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
        <View className="mb-2 self-start rounded-full bg-accent-tint px-2 py-0.5 dark:bg-accent/15">
          <Text className="text-xs font-semibold text-accent-text dark:text-accent-dark">
            🔥 Popular
          </Text>
        </View>
      ) : null}
      <View className="flex-row gap-3">
        <Avatar uri={log.dj?.imageUrl} name={log.dj?.name ?? "?"} size={40} />
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-ink dark:text-paper">
              {log.dj?.name ?? "Unknown DJ"}
            </Text>
            <RatingStars value={log.ratingHalfStars} size={14} />
          </View>
          {log.user ? (
            <Pressable
              className="mt-1 self-start"
              hitSlop={4}
              onPress={(e) => {
                // Card wraps this whole row in its own Link, so stop the press
                // from bubbling up and navigating to the log detail instead.
                e.stopPropagation();
                router.push(ROUTES.USER(log.user!.username));
              }}
            >
              <Text className="text-xs text-muted">
                logged by {log.user.displayName ?? log.user.username}
              </Text>
            </Pressable>
          ) : null}
          {log.event ? (
            <Text className="mt-1 text-sm text-muted">
              {log.event.name} · {log.event.venue}
            </Text>
          ) : null}
          <Text className="mt-1 text-xs text-muted">{formatDate(log.seenAt)}</Text>
          {log.reviewText ? (
            <Text className="mt-2 text-sm text-ink dark:text-paper" numberOfLines={3}>
              {log.reviewText}
            </Text>
          ) : null}
          <View className="mt-2">
            <CrowdVibeBadge vibe={log.crowdVibe} />
          </View>
        </View>
      </View>
    </Card>
  );
}
