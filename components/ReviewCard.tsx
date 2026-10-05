import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Avatar, Card, Icon, RatingStars, Skeleton, Text, useIsDesktopWeb } from "./ui";

import type { Dj, Event, Review, User } from "../lib/api/types";
import { formatDate } from "../lib/format";
import { reviewSubject } from "../lib/review";
import { ROUTES } from "../lib/routes";
import { ReviewTags } from "./ReviewTags";

function PopularBadge() {
  return (
    <View className="flex-row items-center gap-0.5 self-start rounded-full bg-accent-tint px-2 py-0.5 dark:bg-accent/15">
      <Icon name="flame" size={10} className="text-accent-text dark:text-accent-dark" />
      <Text className="text-[10px] text-accent-text dark:text-accent-dark">Popular</Text>
    </View>
  );
} 

export function ReviewCard({
  review,
}: {
  review: Review & { user?: User; dj?: Dj; event?: Event | null; isPopular?: boolean };
}) {
  // Phone widths stack the stars under the title line so a long name +
  // event + date doesn't wrap into a narrow column beside them.
  const isDesktopWeb = useIsDesktopWeb();
  const subject = reviewSubject(review);
  return (
    <Card href={ROUTES.REVIEW_DETAIL(review.id)}>
      <View className="flex-row gap-3">
        <Avatar uri={subject.imageUrl} name={subject.name} size={90} />
        <View className="flex-1">
          <View
            className={isDesktopWeb ? "flex-row items-start justify-between gap-2" : "items-start gap-1"}
          >
            <Text className="shrink text-base font-semibold text-ink dark:text-paper">
              {subject.name}
              <Text className="text-sm text-muted">
                {[...subject.where, formatDate(review.seenAt)]
                  .map((part) => ` · ${part}`)
                  .join("")}
              </Text>
            </Text>
            <RatingStars value={review.rating} size={16} />
          </View>
          {review.user && (
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
              <View className="flex-row items-center gap-1 justify-between">
                <Text className="text-xs text-muted">
                  reviewed by @{review.user.username}
                </Text>
                {review.isPopular && <PopularBadge />}
              </View>
            </Pressable>
          )}
          {review.reviewText && 
            <Text className="mt-2 text-sm text-ink dark:text-paper" numberOfLines={3}>
              {review.reviewText}
            </Text>
          }
          {!!review.tags?.length && (
            <View className="mt-2">
              <ReviewTags tags={review.tags} limit={3} />
            </View>
          )}
        </View>
      </View>
    </Card>
  );
}

// Line widths vary a little per row so a list of skeletons doesn't read as
// one block stamped out repeatedly.
const SKELETON_WIDTHS = [
  { name: "w-28", meta: "w-24", by: "w-28", line: "w-4/5", tags: "w-20" },
  { name: "w-24", meta: "w-28", by: "w-24", line: "w-3/5", tags: "w-16" },
  { name: "w-32", meta: "w-20", by: "w-32", line: "w-2/3", tags: "w-[72px]" },
];

// Loading placeholder with ReviewCard's layout — same avatar size/shape, title
// + meta line, stars (beside the title on desktop web, under it on phones),
// "reviewed by" line, two lines of text and a tag pill. Pass `count`
// to fill a list.
export function ReviewCardSkeleton({ count = 1 }: { count?: number }) {
  const isDesktopWeb = useIsDesktopWeb();
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const w = SKELETON_WIDTHS[i % SKELETON_WIDTHS.length];
        return (
          <Card key={i}>
            <View className="flex-row gap-3">
              {/* Matches Avatar size={90}: borderRadius = size * 0.22. */}
              <Skeleton className="h-[90px] w-[90px] rounded-[20px]" />
              <View className="flex-1">
                <View
                  className={
                    isDesktopWeb ? "flex-row items-start justify-between gap-2" : "items-start gap-1"
                  }
                >
                  <View className="h-6 flex-row items-center gap-2">
                    <Skeleton className={`h-4 ${w.name}`} />
                    <Skeleton className={`h-3 ${w.meta}`} />
                  </View>
                  <View className="h-4 flex-row items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Skeleton key={s} className="h-3.5 w-3.5 rounded-full" />
                    ))}
                  </View>
                </View>
                <Skeleton className={`mt-2 h-3 ${w.by}`} />
                <Skeleton className="mt-3 h-3 w-full" />
                <Skeleton className={`mt-2 h-3 ${w.line}`} />
                <Skeleton className={`mt-3 h-6 ${w.tags} rounded-full`} />
              </View>
            </View>
          </Card>
        );
      })}
    </>
  );
}
