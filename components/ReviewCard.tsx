import { Link, router, type Href } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import {
  Avatar,
  Card,
  FadeInView,
  FitText,
  Icon,
  paperAt,
  type Paper,
  Photo,
  RatingStamp,
  Skeleton,
  Tape,
  Text,
  tiltFor,
} from "./ui";

import type { Dj, DjReview, Review, User } from "../lib/api/types";
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
// How many DJ reviews a night card in a list shows before "+N more".
const SETS_SHOWN = 3;

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

// Like and comment counts, read-only: liking and commenting happen on the
// review's own page.
function EngagementCounts({ review }: { review: ReviewCardReview }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="flex-row items-center gap-1">
        <Icon name={review.isLikedByMe ? "heart" : "heart-outline"} size={15} className="text-paper" />
        <Text className="font-numeric text-base leading-5 text-paper">{review.likeCount ?? 0}</Text>
      </View>
      <View className="flex-row items-center gap-1">
        <Icon name="chatbubble-outline" size={14} className="text-paper" />
        <Text className="font-numeric text-base leading-5 text-paper">{review.commentCount ?? 0}</Text>
      </View>
    </View>
  );
}

// Tags, then the reviewer's name tag and the like/comment counts (or, on the
// review's own page, `actions`), along the bottom of either card.
function CardFooter({
  review,
  expanded,
  actions,
}: {
  review: ReviewCardReview;
  expanded: boolean;
  actions?: ReactNode;
}) {
  return (
    <View className="mt-3 gap-y-2">
      <ReviewTags tags={review.tags} limit={expanded ? undefined : 3} />
      {expanded && !!review.taggedUsers?.length && (
        <Text className="font-display text-lg uppercase text-paper/85">
          With {review.taggedUsers.map((u) => `@${u.username}`).join(", ")}
        </Text>
      )}
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        {review.user ? <Reviewer user={review.user} /> : <View />}
        {actions ?? <EngagementCounts review={review} />}
      </View>
    </View>
  );
}

const TAG_HEIGHT = 30;
const AVATAR_SIZE = 38;
const TAIL_WIDTH = 10;
// How far in from the tag's edge the notch's point sits.
const TAIL_NOTCH = 4;
// tailwind `paper`, for the SVG fill.
const PAPER = "#F6F6F9";

// Who wrote it, along the bottom of either card: their avatar in a white
// ring, pinned over a paper name tag with a notched tail, linked to their
// profile.
function Reviewer({ user }: { user: User }) {
  return (
    <Pressable
      hitSlop={4}
      className="flex-row items-center active:opacity-80"
      style={{ height: AVATAR_SIZE }}
      onPress={(e) => {
        // A list card wraps everything in its own Link, so stop the press
        // from bubbling up and opening the review detail instead.
        e.stopPropagation();
        router.push(ROUTES.USER(user.username));
      }}
    >
      <View className="flex-row items-center" style={{ marginLeft: AVATAR_SIZE / 2 }}>
        <View className="justify-center bg-paper pr-2" style={{ height: TAG_HEIGHT, paddingLeft: AVATAR_SIZE / 2 + 8 }}>
          <Text className="font-display text-xl uppercase leading-6 tracking-wider text-ink" numberOfLines={1}>
            @{user.username}
          </Text>
        </View>
        {/* Swallowtail, as a vector shape so its slanted edges stay smooth.
            Overlaps the tag by a pixel so no seam shows between them. */}
        <Svg width={TAIL_WIDTH + 1} height={TAG_HEIGHT} style={{ marginLeft: -1 }}>
          <Path
            d={`M0 0 H${TAIL_WIDTH + 1} L${TAIL_NOTCH} ${TAG_HEIGHT / 2} L${TAIL_WIDTH + 1} ${TAG_HEIGHT} H0 Z`}
            fill={PAPER}
          />
        </Svg>
      </View>
      <View
        className="absolute left-0 top-0 overflow-hidden rounded-full border-[3px] border-paper bg-paper"
        style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
      >
        <Avatar uri={user.avatarUrl} name={user.username} size={AVATAR_SIZE - 6} />
      </View>
    </Pressable>
  );
}

// Text that links to `href` on the review's own page; on a list card the
// whole card is already a link to the review, so it stays plain.
function MaybeLink({ href, expanded, children }: { href: Href | null; expanded: boolean; children: ReactNode }) {
  if (!expanded || !href) return <>{children}</>;
  return (
    <Link href={href} asChild>
      <Pressable className="active:opacity-80">{children}</Pressable>
    </Link>
  );
}

// "Event @ Venue" under a DJ's name, each part linked on the review's page.
function WhereLine({ review, expanded }: { review: ReviewCardReview; expanded: boolean }) {
  const where = reviewSubject(review).where;
  if (!where.length) return null;
  const log = review.log;
  if (!expanded || !log) {
    return <Text className="mt-1 font-display text-xl uppercase leading-6 text-paper">{where.join(" @ ")}</Text>;
  }
  const hrefFor = (part: string): Href | null =>
    log.event && part === log.event.name
      ? ROUTES.EVENT(log.event.slug)
      : log.venueId && part === log.venue
        ? ROUTES.VENUE(log.venueId)
        : null;
  return (
    <Text className="mt-1 font-display text-xl uppercase leading-6 text-paper">
      {where.map((part, i) => {
        const href = hrefFor(part);
        return (
          <Text key={part}>
            {!!i && " @ "}
            {href ? (
              <Link href={href}>
                <Text className="underline">{part}</Text>
              </Link>
            ) : (
              part
            )}
          </Text>
        );
      })}
    </Text>
  );
}

type CardProps = {
  review: ReviewCardReview;
  paper: Paper;
  expanded: boolean;
  actions?: ReactNode;
};

// A wire paper clip, drawn as two nested loops. Absolutely positioned with
// `style`; it sits over everything so it reads as gripping what's under it.
function PaperClip({ style }: { style?: { top?: number; left?: number; right?: number } }) {
  return (
    <View
      pointerEvents="none"
      className="shadow-sm shadow-black/60"
      style={{ position: "absolute", width: 15, height: 48, zIndex: 3, transform: [{ rotate: "-6deg" }], ...style }}
    >
      <View className="absolute inset-0 rounded-full border-[2.5px] border-[#C9CDD3]" />
      <View className="absolute left-[3.5px] top-[9px] h-[33px] w-2 rounded-full border-[2.5px] border-[#AEB3BA]" />
    </View>
  );
}

const POLAROID_PHOTO = 104;

// The DJ's photo as a polaroid: white print, square photo, a blank strip
// underneath, paper-clipped to the card's top edge.
function Polaroid({ uri, paper, rotate }: { uri?: string | null; paper: Paper; rotate: number }) {
  return (
    <View
      className="bg-paper p-1.5 pb-5 shadow-lg shadow-black/50"
      style={{ width: POLAROID_PHOTO + 12, transform: [{ rotate: `${rotate}deg` }] }}
    >
      <Photo
        uri={uri}
        width={POLAROID_PHOTO}
        placeholderClassName={paper.photoPlaceholderClassName}
        silhouetteClassName={paper.photoSilhouetteClassName}
      />
      <PaperClip style={{ top: -26, left: 22 }} />
    </View>
  );
}

// One DJ's set (purple or red paper, see paperAt): big name, and their photo
// as a polaroid clipped to the card's top edge on the right, the rating
// stamped over the bottom corner.
function DjReviewCard({ review, paper, expanded, actions }: CardProps) {
  const subject = reviewSubject(review);
  return (
    <Card
      href={expanded ? undefined : ROUTES.REVIEW_DETAIL(review.id, { tint: paper.tint })}
      tint={paper.tint}
      torn
      tilt={tiltFor(review.id)}
      className="pb-6"
    >
      <Tape style={{ top: -10, left: 24 }} rotate={-4} />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className={`font-display text-base uppercase ${paper.inkClassName}`}>{cardLabel(review, false)}</Text>
            {review.isPopular && <PopularMark />}
          </View>
          <View className="mt-6">
            <MaybeLink href={subject.href} expanded={expanded}>
              <FitText fontSize={60} numberOfLines={3} className="text-paper">
                {subject.name}
              </FitText>
            </MaybeLink>
          </View>
          <WhereLine review={review} expanded={expanded} />
        </View>
        <View className="-mt-2">
          <MaybeLink href={subject.href} expanded={expanded}>
            <Polaroid uri={subject.imageUrl} paper={paper} rotate={3} />
          </MaybeLink>
        </View>
      </View>
      {!!review.reviewText && (
        <Text
          className={`mt-3 pr-16 text-paper ${expanded ? "text-lg leading-7" : "text-base leading-6"}`}
          numberOfLines={expanded ? undefined : 4}
        >
          {review.reviewText}
        </Text>
      )}
      <View className="pr-20">
        <CardFooter review={review} expanded={expanded} actions={actions} />
      </View>
      <View className="absolute -bottom-5 right-1">
        <RatingStamp value={review.rating} size={76} />
        <Tape style={{ bottom: 2, right: -12 }} width={56} rotate={-14} />
      </View>
    </Card>
  );
}

// One row per DJ reviewed on a night out: photo, name, what was said and
// the rating. A list card shows the first SETS_SHOWN.
function SetReviews({ sets, paper, expanded }: { sets: DjReview[]; paper: Paper; expanded: boolean }) {
  const shown = expanded ? sets : sets.slice(0, SETS_SHOWN);
  const hidden = sets.length - shown.length;
  return (
    <View className="mt-3">
      {shown.map((set) => (
        <View key={set.id} className="mt-3 flex-row gap-3 border-t-2 border-paper/25 pt-3">
          <MaybeLink href={set.dj ? ROUTES.DJ(set.dj.slug) : null} expanded={expanded}>
            <Photo
              uri={set.dj?.imageUrl}
              width={52}
              height={52}
              placeholderClassName={paper.photoPlaceholderClassName}
              silhouetteClassName={paper.photoSilhouetteClassName}
            />
          </MaybeLink>
          <View className="flex-1">
            <MaybeLink href={set.dj ? ROUTES.DJ(set.dj.slug) : null} expanded={expanded}>
              <Text
                className="font-display text-2xl uppercase leading-7 text-paper"
                numberOfLines={expanded ? undefined : 1}
              >
                {set.dj?.name ?? "A DJ"}
              </Text>
            </MaybeLink>
            {!!set.reviewText && (
              <Text
                className={`text-paper ${expanded ? "text-lg leading-7" : "text-base leading-6"}`}
                numberOfLines={expanded ? undefined : 2}
              >
                {set.reviewText}
              </Text>
            )}
          </View>
          <RatingStamp value={set.rating} size={expanded ? 56 : 48} />
        </View>
      ))}
      {!!hidden && (
        <Text className={`mt-2 font-display text-base uppercase ${paper.inkClassName}`}>
          +{hidden} more {hidden === 1 ? "set" : "sets"}
        </Text>
      )}
    </View>
  );
}

// A whole night out (purple or red paper): the night's name (or, with no
// event name, its lineup), its rating and review, then each DJ reviewed on
// it - or, with no DJ reviews, its lineup as a row of photos. A night with several DJ reviews and no night review gets
// this card too, without the night's own stamp and text.
function NightReviewCard({ review, sets, paper, expanded, actions }: CardProps & { sets: DjReview[] }) {
  const isNightReview = !review.dj;
  const lineup = review.log?.lineup ?? [];
  const reviewedDjIds = new Set(sets.map((set) => set.djId));
  const unreviewed = lineup.filter((dj) => !reviewedDjIds.has(dj.id));
  // The review's own page shows the whole lineup, LINEUP_SHOWN to a row.
  const shown = !sets.length ? (expanded ? lineup : lineup.slice(0, LINEUP_SHOWN)) : [];
  const hidden = sets.length ? 0 : lineup.length - shown.length;
  const subject = reviewSubject({ log: review.log });
  // A night with no event name is headlined by who played (linking to a
  // solo DJ's page), with the venue on the line under it.
  const djTitle = !review.log?.event && !!lineup.length;
  const title = djTitle ? lineup.map((dj) => dj.name).join(" · ") : subject.name;
  const titleHref = djTitle ? (lineup.length === 1 ? ROUTES.DJ(lineup[0].slug) : null) : subject.href;
  const venue = review.log?.venue && review.log.venue !== title ? review.log.venue : null;
  const venueHref = review.log?.venueId ? ROUTES.VENUE(review.log.venueId) : null;
  const rows = Array.from({ length: Math.ceil(shown.length / LINEUP_SHOWN) }, (_, i) =>
    shown.slice(i * LINEUP_SHOWN, (i + 1) * LINEUP_SHOWN),
  );

  return (
    <Card
      href={expanded ? undefined : ROUTES.REVIEW_DETAIL(review.id, { tint: paper.tint })}
      tint={paper.tint}
      torn
      tilt={tiltFor(review.id)}
      className="pb-5"
    >
      <View className="pr-20">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className={`font-display text-base uppercase ${paper.inkClassName}`}>
            {cardLabel(review, isNightReview)}
          </Text>
          {review.isPopular && <PopularMark />}
        </View>
        <View className="mt-1">
          <MaybeLink href={titleHref} expanded={expanded}>
            <FitText fontSize={48} numberOfLines={3} className="text-paper">
              {title}
            </FitText>
          </MaybeLink>
        </View>
        {!!venue && (
          <Text className="font-display text-lg uppercase text-paper/90">
            @{" "}
            {expanded && venueHref ? (
              <Link href={venueHref}>
                <Text className="underline">{venue}</Text>
              </Link>
            ) : (
              venue
            )}
          </Text>
        )}
      </View>
      {isNightReview && (
        <View className="absolute right-3 top-3">
          <RatingStamp value={review.rating} size={64} />
        </View>
      )}
      {rows.map((row, r) => (
        <View key={r} className="mt-3 flex-row gap-3">
          {row.map((dj) => (
            <View key={dj.id} className="flex-1">
              <MaybeLink href={ROUTES.DJ(dj.slug)} expanded={expanded}>
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
              </MaybeLink>
            </View>
          ))}
          {/* Keep tiles the same width when the row is short. */}
          {Array.from({ length: LINEUP_SHOWN - row.length }).map((_, i) => (
            <View key={`pad-${i}`} className="flex-1" />
          ))}
        </View>
      ))}
      {!!hidden && (
        <Text className={`mt-1 font-display text-base uppercase ${paper.inkClassName}`}>
          +{hidden} more on the lineup
        </Text>
      )}
      {isNightReview && !!review.reviewText && (
        <Text
          className={`mt-3 text-paper ${expanded ? "text-lg leading-7" : "text-base leading-6"}`}
          numberOfLines={expanded ? undefined : 3}
        >
          {review.reviewText}
        </Text>
      )}
      {!!sets.length && <SetReviews sets={sets} paper={paper} expanded={expanded} />}
      {!!sets.length && !!unreviewed.length && (
        <Text className={`mt-3 font-display text-base uppercase ${paper.inkClassName}`}>
          Also saw {unreviewed.map((dj) => dj.name).join(", ")}
        </Text>
      )}
      <CardFooter review={review} expanded={expanded} actions={actions} />
    </Card>
  );
}

// `index` is the card's position in its list: purple and red alternate.
// The review's own page renders the same card `expanded` - not a link, the
// full text, tags and lineup, its DJ/event/venue linked - on the `paper` it
// was opened from, with `actions` (the like button) in place of the counts.
export function ReviewCard({
  review,
  index,
  paper = paperAt(index),
  expanded = false,
  actions,
}: {
  review: ReviewCardReview;
  index: number;
  paper?: Paper;
  expanded?: boolean;
  actions?: ReactNode;
}) {
  const props = { review, paper, expanded, actions };
  // A night out is one post: its lead review (the night's, or a DJ's when
  // there's no night review) plus the night's other DJ reviews. Only a post
  // that's a single DJ review gets the DJ card.
  const djReviews = review.djReviews ?? [];
  const sets: DjReview[] = review.dj ? [review as DjReview, ...djReviews] : djReviews;
  return (
    <FadeInView index={index}>
      {review.dj && !djReviews.length ? <DjReviewCard {...props} /> : <NightReviewCard {...props} sets={sets} />}
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
export function ReviewCardSkeleton({ count = 1, paper }: { count?: number; paper?: Paper }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const w = SKELETON_WIDTHS[i % SKELETON_WIDTHS.length];
        return (
          <Card key={i} blank tint={(paper ?? paperAt(i)).tint} torn tilt={tiltFor(`skeleton-${i}`)} className="pb-6">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Skeleton tone="paper" className={`h-4 ${w.label}`} />
                <Skeleton tone="paper" className={`mt-7 h-12 ${w.name}`} />
                <Skeleton tone="paper" className={`mt-2 h-5 ${w.where}`} />
              </View>
              <Skeleton tone="paper" className="-mt-2 h-[160px] w-[116px] rounded-none" />
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
