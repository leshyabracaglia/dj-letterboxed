import { Link, router, type Href } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import {
  Avatar,
  Card,
  FadeInView,
  FitText,
  Icon,
  paperAt,
  type Paper,
  Photo,
  Skeleton,
  skeletonTone,
  Tape,
  Text,
} from "./ui";

import type { LineupEntry, Review, ReviewTrack, User } from "@/lib/api/types";
import { pluralWord } from "@/lib/format";
import { nightDateParts, reviewedSets, reviewSubject, soloSet, tracksFrom } from "@/lib/review";
import { ROUTES } from "@/lib/routes";
import { NightStamp } from "./NightStamp";
import { ReviewTags } from "./ReviewTags";
import { TrackRow } from "./TrackRow";

// How many lineup photos a night card shows before "+N more".
const LINEUP_SHOWN = 3;
// How many DJ reviews a night card in a list shows before "+N more".
const SETS_SHOWN = 3;
// How many of a set's (or the night's) tracks a card in a list shows.
const TRACKS_SHOWN = 1;

// Tracks highlighted from a set or the night: on a list card the first
// TRACKS_SHOWN (note clamped) and a count of the rest; on the review's own
// page all of them, in full.
function Tracks({
  tracks,
  paper,
  expanded,
  trackExtra,
}: {
  tracks: ReviewTrack[];
  paper: Paper;
  expanded: boolean;
  trackExtra?: (track: ReviewTrack) => ReactNode;
}) {
  if (!tracks.length) return null;
  const shown = expanded ? tracks : tracks.slice(0, TRACKS_SHOWN);
  const hidden = tracks.length - shown.length;
  return (
    <View className="mt-2 gap-2">
      {shown.map((track) => (
        <View key={track.id}>
          {/* A named track on a darker panel; an open ID on a white one, so
              it stands out as a question. */}
          <View className={track.title ? "bg-black/25 p-2" : "bg-paper p-2"}>
            <TrackRow track={track} noteLines={expanded ? undefined : 2} light={!track.title} />
          </View>
          {expanded && trackExtra?.(track)}
        </View>
      ))}
      {!!hidden && (
        <Text variant="display" className={`text-sm ${paper.inkClassName}`}>
          +{hidden} more {pluralWord(hidden, "track")}
        </Text>
      )}
    </View>
  );
}

/** "SAT 14 SEP · NIGHT" (plus "· WHOLE NIGHT" when the night itself is
 * written about). */
function cardLabel(review: Review, wholeNight: boolean): string {
  return nightDateParts(review, { wholeNight }).join(" · ");
}

function PopularMark() {
  return (
    <View className="flex-row items-center gap-0.5">
      <Icon name="flame" size={12} className="text-paper" />
      <Text variant="display" className="text-sm text-paper">
        Popular
      </Text>
    </View>
  );
}

// The reviewer checked in at the venue that night (the review is verified).
function VerifiedMark() {
  return (
    <View
      accessible
      accessibilityLabel="Verified: checked in at the venue"
      className="flex-row items-center gap-0.5"
      testID="verified-mark"
    >
      <Icon name="checkmark-circle" size={12} className="text-paper" />
      <Text variant="display" className="text-xs text-paper">
        Verified
      </Text>
    </View>
  );
}

// Like and comment counts, read-only: liking and commenting happen on the
// review's own page.
function EngagementCounts({ review }: { review: Review }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="flex-row items-center gap-1">
        <Icon name={review.isLikedByMe ? "heart" : "heart-outline"} size={15} className="text-paper" />
        <Text className="font-numeric text-base leading-5 text-paper">{review.likeCount}</Text>
      </View>
      <View className="flex-row items-center gap-1">
        <Icon name="chatbubble-outline" size={14} className="text-paper" />
        <Text className="font-numeric text-base leading-5 text-paper">{review.commentCount}</Text>
      </View>
    </View>
  );
}

// The review's tags, above the stub.
function CardTags({ review, expanded }: { review: Review; expanded: boolean }) {
  if (!review.tags.length) return null;
  return (
    <View className="mt-2.5">
      <ReviewTags tags={review.tags} limit={expanded ? undefined : 3} />
    </View>
  );
}

const NOTCH = 14;

// A ticket's perforation across the whole card, notched at both edges, that
// the stub tears off along.
function Perforation() {
  return (
    <View className="-mx-4 mt-3 flex-row items-center">
      <View className="rounded-full bg-ink" style={{ width: NOTCH, height: NOTCH, marginLeft: -NOTCH / 2 }} />
      <View className="flex-1 border-t-2 border-dashed border-paper/40" />
      <View className="rounded-full bg-ink" style={{ width: NOTCH, height: NOTCH, marginRight: -NOTCH / 2 }} />
    </View>
  );
}

// The stub along the bottom of either card: who wrote it (and whether they
// checked in), who they were with, and on a list card the like and comment
// counts. Liking and commenting happen under the card on its own page.
function Stub({ review, expanded }: { review: Review; expanded: boolean }) {
  return (
    <View>
      <Perforation />
      <View className="mt-2.5 flex-row items-center justify-between gap-3">
        {review.user && <Reviewer user={review.user} verified={review.verified} tagged={review.taggedUsers} />}
        {!expanded && <EngagementCounts review={review} />}
      </View>
    </View>
  );
}

const AVATAR_SIZE = 30;

// Who wrote it: their avatar and name (linked to their profile), a verified
// mark if they checked in, and who they tagged as being there.
function Reviewer({ user, verified, tagged }: { user: User; verified: boolean; tagged: User[] }) {
  return (
    <Pressable
      hitSlop={4}
      className="flex-1 flex-row items-center gap-2 active:opacity-80"
      onPress={(e) => {
        e.stopPropagation();
        router.push(ROUTES.USER(user.username));
      }}
    >
      <View
        className="overflow-hidden rounded-full border-2 border-paper bg-paper"
        style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
      >
        <Avatar uri={user.avatarUrl} name={user.username} size={AVATAR_SIZE - 4} />
      </View>
      <View className="flex-1">
        <View className="flex-row flex-wrap items-center gap-x-2">
          <Text variant="display" className="text-lg leading-5 text-paper" numberOfLines={1}>
            {user.username}
          </Text>
          {verified && <VerifiedMark />}
        </View>
        {!!tagged.length && (
          <Text className="text-xs text-paper/75" numberOfLines={1}>
            with {tagged.map((u) => `@${u.username}`).join(", ")}
          </Text>
        )}
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
function WhereLine({ review, set, expanded }: { review: Review; set: LineupEntry; expanded: boolean }) {
  const where = reviewSubject(review, set).where;
  if (!where.length) return null;
  if (!expanded) {
    return (
      <Text variant="display" className="text-lg leading-5 text-paper">
        {where.join(" @ ")}
      </Text>
    );
  }
  const hrefFor = (part: string): Href | null =>
    review.event && part === review.event.name
      ? ROUTES.EVENT(review.event.slug)
      : review.venueId && part === review.venue
        ? ROUTES.VENUE(review.venueId)
        : null;
  return (
    <Text variant="display" className="text-lg leading-5 text-paper">
      {where.map((part, i) => {
        const href = hrefFor(part);
        return (
          <Text key={part}>
            {!!i && " @ "}
            {href ? (
              <Link href={href}>
                <Text>{part}</Text>
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
  review: Review;
  paper: Paper;
  expanded: boolean;
  // Under each track on the review's own page (its ID request).
  trackExtra?: (track: ReviewTrack) => ReactNode;
};

const POLAROID_PHOTO = 104;

// The DJ's photo, in a white border, taped onto the card's top edge.
function Polaroid({ uri, paper }: { uri?: string | null; paper: Paper }) {
  return (
    <View className="mt-2 border-4 border-paper shadow-lg shadow-black/50">
      <Photo
        uri={uri}
        width={POLAROID_PHOTO}
        placeholderClassName={paper.photoPlaceholderClassName}
        silhouetteClassName={paper.photoSilhouetteClassName}
      />
      <Tape style={{ top: -12, left: 22 }} width={64} rotate={-5} />
    </View>
  );
}

// One DJ's set (violet or near-black paper, see paperAt), for a post that's
// just that DJ's review (see soloSet): big name, and their photo taped to the
// card's top edge on the right, the night's passport stamp
// over the bottom corner.
function DjReviewCard({ review, set, paper, expanded, trackExtra }: CardProps & { set: LineupEntry }) {
  const subject = reviewSubject(review, set);
  return (
    <Card href={expanded ? undefined : ROUTES.REVIEW_DETAIL(review.id, { tint: paper.tint })} tint={paper.tint} torn>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text variant="display" className={`text-sm ${paper.inkClassName}`}>
              {cardLabel(review, false)}
            </Text>
            {review.isPopular && <PopularMark />}
          </View>
          <View className="mt-2">
            <MaybeLink href={subject.href} expanded={expanded}>
              <FitText fontSize={48} numberOfLines={3} className="text-paper">
                {subject.name}
              </FitText>
            </MaybeLink>
          </View>
          <View className="mt-1" />
          <WhereLine review={review} set={set} expanded={expanded} />
        </View>
        <View className="-mt-2">
          {/* Opens the DJ's page from a list card too, unlike MaybeLink. */}
          <Pressable
            disabled={!subject.href}
            className="active:opacity-80"
            onPress={(e) => {
              e.stopPropagation();
              if (subject.href) router.push(subject.href);
            }}
          >
            <Polaroid uri={subject.imageUrl} paper={paper} />
          </Pressable>
        </View>
      </View>
      {!!set.reviewText && (
        <Text
          className={`mt-2 pr-16 text-paper ${expanded ? "text-base leading-6" : "text-sm leading-5"}`}
          numberOfLines={expanded ? undefined : 4}
        >
          {set.reviewText}
        </Text>
      )}
      <View className="pr-16">
        <Tracks tracks={tracksFrom(review, set.dj.id)} paper={paper} expanded={expanded} trackExtra={trackExtra} />
      </View>
      <View className="pr-16">
        <CardTags review={review} expanded={expanded} />
      </View>
      {/* The stub's right end stays clear of the stamp over its corner. */}
      <View className="pr-20">
        <Stub review={review} expanded={expanded} />
      </View>
      <View className="absolute -bottom-5 right-1">
        <NightStamp review={review} size={76} />
      </View>
    </Card>
  );
}

// One row per DJ reviewed on a night out: photo, name, what was said and
// their tracks. A list card shows the first SETS_SHOWN.
function SetReviews({
  review,
  sets,
  paper,
  expanded,
  trackExtra,
}: {
  review: Review;
  sets: LineupEntry[];
  paper: Paper;
  expanded: boolean;
  trackExtra?: (track: ReviewTrack) => ReactNode;
}) {
  const shown = expanded ? sets : sets.slice(0, SETS_SHOWN);
  const hidden = sets.length - shown.length;
  return (
    <View>
      {shown.map((set) => (
        <View key={set.dj.id} className="mt-2.5 flex-row gap-3 border-t-2 border-paper/25 pt-2.5">
          <MaybeLink href={ROUTES.DJ(set.dj.slug)} expanded={expanded}>
            <Photo
              uri={set.dj.imageUrl}
              width={44}
              height={44}
              placeholderClassName={paper.photoPlaceholderClassName}
              silhouetteClassName={paper.photoSilhouetteClassName}
            />
          </MaybeLink>
          <View className="flex-1">
            <MaybeLink href={ROUTES.DJ(set.dj.slug)} expanded={expanded}>
              <Text variant="display" className="text-xl leading-6 text-paper" numberOfLines={expanded ? undefined : 1}>
                {set.dj.name}
              </Text>
            </MaybeLink>
            {!!set.reviewText && (
              <Text
                className={`text-paper ${expanded ? "text-base leading-6" : "text-sm leading-5"}`}
                numberOfLines={expanded ? undefined : 2}
              >
                {set.reviewText}
              </Text>
            )}
            <Tracks tracks={tracksFrom(review, set.dj.id)} paper={paper} expanded={expanded} trackExtra={trackExtra} />
          </View>
        </View>
      ))}
      {!!hidden && (
        <Text variant="display" className={`mt-2 text-sm ${paper.inkClassName}`}>
          +{hidden} more {pluralWord(hidden, "set")}
        </Text>
      )}
    </View>
  );
}

// A whole night out (purple or red paper): the night's name (or, with no
// event name, its lineup), its passport stamp, review and tracks from the
// night, then each DJ reviewed on it - or, with none, its lineup as a row of
// photos.
function NightReviewCard({ review, paper, expanded, trackExtra }: CardProps) {
  const sets = reviewedSets(review);
  const lineup = review.lineup.map((entry) => entry.dj);
  const unreviewed = review.lineup.filter((entry) => !entry.reviewText).map((entry) => entry.dj);
  // The review's own page shows the whole lineup, LINEUP_SHOWN to a row.
  const shown = !sets.length ? (expanded ? lineup : lineup.slice(0, LINEUP_SHOWN)) : [];
  const hidden = sets.length ? 0 : lineup.length - shown.length;
  const subject = reviewSubject(review);
  // A night with no event name is headlined by who played (linking to a
  // solo DJ's page), with the venue on the line under it.
  const djTitle = !review.event && !!lineup.length;
  const title = djTitle ? lineup.map((dj) => dj.name).join(" · ") : subject.name;
  const titleHref = djTitle ? (lineup.length === 1 ? ROUTES.DJ(lineup[0].slug) : null) : subject.href;
  const venue = review.venue && review.venue !== title ? review.venue : null;
  const venueHref = review.venueId ? ROUTES.VENUE(review.venueId) : null;
  const rows = Array.from({ length: Math.ceil(shown.length / LINEUP_SHOWN) }, (_, i) =>
    shown.slice(i * LINEUP_SHOWN, (i + 1) * LINEUP_SHOWN),
  );

  return (
    <Card
      href={expanded ? undefined : ROUTES.REVIEW_DETAIL(review.id, { tint: paper.tint })}
      tint={paper.tint}
      torn

      className="pb-5"
    >
      <View className="pr-20">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text variant="display" className={`text-sm ${paper.inkClassName}`}>
            {cardLabel(review, !!review.reviewText)}
          </Text>
          {review.isPopular && <PopularMark />}
        </View>
        <View className="mt-1">
          <MaybeLink href={titleHref} expanded={expanded}>
            <FitText fontSize={40} numberOfLines={3} className="text-paper">
              {title}
            </FitText>
          </MaybeLink>
        </View>
        {!!venue && (
          <Text variant="display" className="text-base text-paper/90">
            @{" "}
            {expanded && venueHref ? (
              <Link href={venueHref}>
                <Text>{venue}</Text>
              </Link>
            ) : (
              venue
            )}
          </Text>
        )}
      </View>
      <View className="absolute right-3 top-3">
        <NightStamp review={review} size={64} />
      </View>
      {rows.map((row, r) => (
        <View key={r} className="mt-2.5 flex-row gap-3">
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
                <Text variant="display" className="mt-1 text-lg leading-5 text-paper" numberOfLines={1}>
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
        <Text variant="display" className={`mt-1 text-sm ${paper.inkClassName}`}>
          +{hidden} more on the lineup
        </Text>
      )}
      {!!review.reviewText && (
        <Text
          className={`mt-2 text-paper ${expanded ? "text-base leading-6" : "text-sm leading-5"}`}
          numberOfLines={expanded ? undefined : 3}
        >
          {review.reviewText}
        </Text>
      )}
      <Tracks tracks={tracksFrom(review, null)} paper={paper} expanded={expanded} trackExtra={trackExtra} />
      {!!sets.length && (
        <>
          <View className="mt-2" />
          <SetReviews review={review} sets={sets} paper={paper} expanded={expanded} trackExtra={trackExtra} />
        </>
      )}
      {!!sets.length && !!unreviewed.length && (
        <Text variant="display" className={`mt-2.5 text-sm ${paper.inkClassName}`}>
          Also saw {unreviewed.map((dj) => dj.name).join(", ")}
        </Text>
      )}
      <CardTags review={review} expanded={expanded} />
      <Stub review={review} expanded={expanded} />
    </Card>
  );
}

// `index` is the card's position in its list: purple and red alternate.
// The review's own page renders the same card `expanded` - not a link, the
// full text, tags and lineup, its DJ/event/venue linked - on the `paper` it
// was opened from, without the counts (its actions sit under the card).
export function ReviewCard({
  review,
  index,
  paper = paperAt(index),
  expanded = false,
  trackExtra,
}: {
  review: Review;
  index: number;
  paper?: Paper;
  expanded?: boolean;
  trackExtra?: (track: ReviewTrack) => ReactNode;
}) {
  const props = { review, paper, expanded, trackExtra };
  // A night out is one post. Only one that's really a single DJ's review
  // (nothing said about the night itself, see soloSet) gets the DJ card.
  const set = soloSet(review);
  return (
    <FadeInView index={index}>
      {set ? <DjReviewCard {...props} set={set} /> : <NightReviewCard {...props} />}
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
    <View className="gap-10">
      {Array.from({ length: count }).map((_, i) => {
        const w = SKELETON_WIDTHS[i % SKELETON_WIDTHS.length];
        const tint = (paper ?? paperAt(i)).tint;
        const tone = skeletonTone(tint);
        return (
          <Card key={i} blank tint={tint} torn className="pb-6">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Skeleton tone={tone} className={`h-4 ${w.label}`} />
                <Skeleton tone={tone} className={`mt-3 h-12 ${w.name}`} />
                <Skeleton tone={tone} className={`mt-2 h-5 ${w.where}`} />
              </View>
              {/* The DJ's photo in its white border. */}
              <Skeleton tone={tone} className="mt-2 h-[116px] w-[116px]" />
            </View>
            <View className="pr-16">
              <Skeleton tone={tone} className="mt-4 h-3.5 w-full" />
              <Skeleton tone={tone} className={`mt-2.5 h-3.5 ${w.line}`} />
            </View>
            <View className="mt-4 flex-row gap-1.5">
              <Skeleton tone={tone} className="h-6 w-16" />
              <Skeleton tone={tone} className="h-6 w-14" />
            </View>
            {/* The stub: perforation, then the reviewer. */}
            <View className="mt-4 border-t-2 border-dashed border-paper/20" />
            <View className="mt-3 flex-row items-center gap-2">
              <Skeleton tone={tone} className="h-[30px] w-[30px] rounded-full" />
              <Skeleton tone={tone} className="h-4 w-28" />
            </View>
            <View className="absolute -bottom-5 right-1">
              <Skeleton tone={tone} className="h-[76px] w-[76px] rounded-full" />
            </View>
          </Card>
        );
      })}
    </View>
  );
}
