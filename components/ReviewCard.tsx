import { router } from "expo-router";
import { Pressable, View } from "react-native";
import {
  Card,
  FadeInView,
  FitText,
  Icon,
  paperAt,
  Photo,
  RatingStamp,
  Skeleton,
  Tape,
  Text,
  tiltFor,
} from "./ui";

import type { Dj, Review, User } from "../lib/api/types";
import { formatCardDate, formatEventTiming } from "../lib/format";
import { reviewSubject } from "../lib/review";
import { ROUTES } from "../lib/routes";
import { ReviewTags } from "./ReviewTags";

type ReviewCardReview = Review & {
  user?: User;
  dj?: Dj;
  isPopular?: boolean;
};

// How many lineup photos a night card shows before "+N more".
const LINEUP_SHOWN = 3;

/** "SAT 14 SEP · NIGHT" (plus "· WHOLE NIGHT" on a night review). */
function cardLabel(review: ReviewCardReview, isNight: boolean): string {
  const parts = [formatCardDate(review.seenAt)];
  if (review.log) parts.push(formatEventTiming(review.log));
  if (isNight) parts.push("Whole night");
  return parts.join(" · ");
}

function PopularMark() {
  return (
    <View className="flex-row items-center gap-0.5">
      <Icon name="flame" size={12} className="text-paper" />
      <Text className="font-display text-sm uppercase text-paper">Popular</Text>
    </View>
  );
}

// Tags then the reviewer's handle, along the bottom of either card.
function CardFooter({ review }: { review: ReviewCardReview }) {
  return (
    <View className="mt-3 flex-row flex-wrap items-center gap-x-2 gap-y-1.5">
      <ReviewTags tags={review.tags} limit={3} />
      {review.user && (
        <Pressable
          hitSlop={4}
          onPress={(e) => {
            // Card wraps everything in its own Link, so stop the press from
            // bubbling up and opening the review detail instead.
            e.stopPropagation();
            router.push(ROUTES.USER(review.user!.username));
          }}
        >
          <Text className="font-display text-base uppercase text-paper/85">@{review.user.username}</Text>
        </Pressable>
      )}
    </View>
  );
}

// One DJ's set (purple or red paper, see paperAt): big name, their photo taped on the right and
// the rating stamped over the bottom corner.
function DjReviewCard({ review, index }: { review: ReviewCardReview; index: number }) {
  const subject = reviewSubject(review);
  const paper = paperAt(index);
  return (
    <Card href={ROUTES.REVIEW_DETAIL(review.id, { tint: paper.tint })} tint={paper.tint} torn tilt={tiltFor(review.id)} className="pb-6">
      <Tape style={{ top: -10, left: 24 }} rotate={-4} />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className={`font-display text-base uppercase ${paper.inkClassName}`}>
              {cardLabel(review, false)}
            </Text>
            {review.isPopular && <PopularMark />}
          </View>
          <View className="mt-6">
            <FitText fontSize={60} numberOfLines={3} className="text-paper">
              {subject.name}
            </FitText>
          </View>
          {!!subject.where.length && (
            <Text className="mt-1 font-display text-xl uppercase leading-6 text-paper">
              {subject.where.join(" @ ")}
            </Text>
          )}
        </View>
        <Photo
          uri={subject.imageUrl}
          width={118}
          height={140}
          framed
          rotate={2}
          placeholderClassName={paper.photoPlaceholderClassName}
          silhouetteClassName={paper.photoSilhouetteClassName}
        />
      </View>
      {!!review.reviewText && (
        <Text className="mt-3 pr-16 text-base leading-6 text-paper" numberOfLines={4}>
          {review.reviewText}
        </Text>
      )}
      <View className="pr-20">
        <CardFooter review={review} />
      </View>
      <View className="absolute -bottom-5 right-1">
        <RatingStamp value={review.rating} size={76} />
        <Tape style={{ bottom: 2, right: -12 }} width={56} rotate={-14} />
      </View>
    </Card>
  );
}

// A whole night (purple or red paper): the night's name, its lineup as a row of photos.
function NightReviewCard({ review, index }: { review: ReviewCardReview; index: number }) {
  const lineup = review.log?.lineup ?? [];
  const shown = lineup.slice(0, LINEUP_SHOWN);
  const hidden = lineup.length - shown.length;
  const title = reviewSubject(review).name;
  const venue = review.log?.venue && review.log.venue !== title ? review.log.venue : null;
  const paper = paperAt(index);

  return (
    <Card href={ROUTES.REVIEW_DETAIL(review.id, { tint: paper.tint })} tint={paper.tint} torn tilt={tiltFor(review.id)} className="pb-5">
      <View className="pr-20">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className={`font-display text-base uppercase ${paper.inkClassName}`}>{cardLabel(review, true)}</Text>
          {review.isPopular && <PopularMark />}
        </View>
        <View className="mt-1">
          <FitText fontSize={48} numberOfLines={3} className="text-paper">
            {title}
          </FitText>
        </View>
        {!!venue && <Text className="font-display text-lg uppercase text-paper/90">@ {venue}</Text>}
      </View>
      <View className="absolute right-3 top-3">
        <RatingStamp value={review.rating} size={64} />
      </View>
      {!!shown.length && (
        <View className="mt-3 flex-row gap-3">
          {shown.map((dj) => (
            <View key={dj.id} className="flex-1">
              <View className="aspect-[1.25]">
                <Photo
                  uri={dj.imageUrl}
                  placeholderClassName={paper.photoPlaceholderClassName}
                  silhouetteClassName={paper.photoSilhouetteClassName}
                />
              </View>
              <Text className="mt-1 font-display text-lg uppercase leading-5 text-paper" numberOfLines={1}>
                {dj.name}
              </Text>
            </View>
          ))}
          {/* Keep tiles the same width when the lineup is short. */}
          {Array.from({ length: LINEUP_SHOWN - shown.length }).map((_, i) => (
            <View key={`pad-${i}`} className="flex-1" />
          ))}
        </View>
      )}
      {!!hidden && (
        <Text className={`mt-1 font-display text-base uppercase ${paper.inkClassName}`}>+{hidden} more on the lineup</Text>
      )}
      {!!review.reviewText && (
        <Text className="mt-3 text-base leading-6 text-paper" numberOfLines={3}>
          {review.reviewText}
        </Text>
      )}
      <CardFooter review={review} />
    </Card>
  );
}

// `index` is the card's position in its list: purple and red alternate.
export function ReviewCard({ review, index }: { review: ReviewCardReview; index: number }) {
  return (
    <FadeInView index={index}>
      {review.dj ? (
        <DjReviewCard review={review} index={index} />
      ) : (
        <NightReviewCard review={review} index={index} />
      )}
    </FadeInView>
  );
}

// Line widths vary a little per row so a list of skeletons doesn't read as
// one block stamped out repeatedly.
const SKELETON_WIDTHS = [
  { label: "w-32", name: "w-40", where: "w-44", line: "w-4/5" },
  { label: "w-28", name: "w-32", where: "w-36", line: "w-3/5" },
  { label: "w-36", name: "w-48", where: "w-32", line: "w-2/3" },
];

// Loading placeholder shaped like the DJ review card — label, big name,
// subline, photo on the right, two lines of text, footer chips and the stamp
// in the corner — on blank paper, so it reads as "not printed yet" rather
// than a half-rendered card. Pass `count` to fill a list.
export function ReviewCardSkeleton({ count = 1 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const w = SKELETON_WIDTHS[i % SKELETON_WIDTHS.length];
        return (
          <Card key={i} blank tint={paperAt(i).tint} torn tilt={tiltFor(`skeleton-${i}`)} className="pb-6">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Skeleton tone="paper" className={`h-4 ${w.label}`} />
                <Skeleton tone="paper" className={`mt-7 h-12 ${w.name}`} />
                <Skeleton tone="paper" className={`mt-2 h-5 ${w.where}`} />
              </View>
              <Skeleton tone="paper" className="h-[140px] w-[118px] rounded-none" />
            </View>
            <View className="pr-16">
              <Skeleton tone="paper" className="mt-4 h-3.5 w-full" />
              <Skeleton tone="paper" className={`mt-2.5 h-3.5 ${w.line}`} />
            </View>
            <View className="mt-4 flex-row gap-1.5">
              <Skeleton tone="paper" className="h-6 w-16 rounded-none" />
              <Skeleton tone="paper" className="h-6 w-14 rounded-none" />
            </View>
            <View className="absolute -bottom-5 right-1">
              <Skeleton tone="paper" className="h-[76px] w-[76px] rounded-full" />
            </View>
          </Card>
        );
      })}
    </>
  );
}
