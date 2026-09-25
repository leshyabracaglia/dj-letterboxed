import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Avatar, Card, RatingStars, Skeleton, Text } from "./ui";

import type { Dj, Event, Review, User } from "../lib/api/types";
import { formatDate } from "../lib/format";
import { ROUTES } from "../lib/routes";
import { CrowdVibeBadge } from "./CrowdVibeBadge";

export function ReviewCard({
  review,
}: {
  review: Review & { user?: User; dj?: Dj; event?: Event | null; isPopular?: boolean };
}) {
  return (
    <Card href={ROUTES.REVIEW_DETAIL(review.id)}>
      {review.isPopular ? (
        <View className="mb-2 self-start rounded-full bg-accent-tint px-2 py-0.5 dark:bg-accent/15">
          <Text className="text-xs font-semibold text-accent-text dark:text-accent-dark">
            🔥 Popular
          </Text>
        </View>
      ) : null}
      <View className="flex-row gap-3">
        <Avatar uri={review.dj?.imageUrl} name={review.dj?.name ?? "?"} size={40} />
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-ink dark:text-paper">
              {review.dj?.name ?? "Unknown DJ"}
            </Text>
            <RatingStars value={review.rating} size={14} />
          </View>
          {review.user ? (
            <Pressable
              className="mt-1 self-start"
              hitSlop={4}
              onPress={(e) => {
                // Card wraps this whole row in its own Link, so stop the press
                // from bubbling up and navigating to the review detail instead.
                e.stopPropagation();
                router.push(ROUTES.USER(review.user!.username));
              }}
            >
              <Text className="text-xs text-muted">
                reviewed by {review.user.displayName ?? review.user.username}
              </Text>
            </Pressable>
          ) : null}
          {review.event ? (
            <Text className="mt-1 text-sm text-muted">
              {review.event.name} · {review.event.venue}
            </Text>
          ) : null}
          <Text className="mt-1 text-xs text-muted">{formatDate(review.seenAt)}</Text>
          {review.reviewText ? (
            <Text className="mt-2 text-sm text-ink dark:text-paper" numberOfLines={3}>
              {review.reviewText}
            </Text>
          ) : null}
          <View className="mt-2">
            <CrowdVibeBadge vibe={review.crowdVibe} />
          </View>
        </View>
      </View>
    </Card>
  );
}

// Loading placeholder with ReviewCard's layout. Pass `count` to fill a list.
export function ReviewCardSkeleton({ count = 1 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <View className="flex-row gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3.5 w-20" />
              </View>
              <Skeleton className="mt-2 h-3 w-24" />
              <Skeleton className="mt-2 h-3 w-16" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-1.5 h-3 w-4/5" />
            </View>
          </View>
        </Card>
      ))}
    </>
  );
}
