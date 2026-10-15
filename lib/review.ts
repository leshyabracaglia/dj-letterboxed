import type { Href } from "expo-router";

import type { LineupEntry, Review } from "./api/types";
import { formatCardDate, formatLogTiming } from "./format";
import { ROUTES } from "./routes";

type Night = Pick<Review, "event" | "venue" | "venueId" | "lineup">;

/** Where a night was: its event name then venue, skipping blanks and a
 * venue that just repeats the event name. */
function nightWhere(night: Night | null | undefined): string[] {
  if (!night) return [];
  const parts = [night.event?.name, night.venue].filter((p): p is string => !!p?.trim());
  return parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase() ? [parts[0]] : parts;
}

// How many DJs a night's title names before "+N".
const NUM_TITLE_DJS = 3;

/** What a night is called: its event, else the DJs seen ("Dixon, Âme +2").
 * Never the venue - that's where it was, not what it was. */
export function getNightTitle(night: Pick<Review, "event" | "lineup"> | null | undefined): string {
  if (night?.event?.name) return night.event.name;
  const names = night?.lineup.map((entry) => entry.dj.name) ?? [];
  if (!names.length) return "A night out";
  const shown = names.slice(0, NUM_TITLE_DJS).join(", ");
  return names.length > NUM_TITLE_DJS ? `${shown} +${names.length - NUM_TITLE_DJS}` : shown;
}

/** When a night was, as label parts to join with " · ": "Sat 14 Sep",
 * "Night", plus "Whole night" when `wholeNight` (the rating shown is the
 * night's, not a DJ's). `withYear` adds the year to the date. */
export function nightDateParts(
  review: Pick<Review, "seenAt" | "isDay" | "isNight">,
  { wholeNight = false, withYear = false }: { wholeNight?: boolean; withYear?: boolean } = {},
): string[] {
  const date = formatCardDate(review.seenAt);
  const parts = [withYear ? `${date} ${new Date(review.seenAt).getFullYear()}` : date, formatLogTiming(review)];
  if (wholeNight) parts.push("Whole night");
  return parts;
}

/** Where a night links to: its event page, or its venue's when it has no
 * event name. */
function nightHref(night: Night): Href | null {
  if (night.event) return ROUTES.EVENT(night.event.slug);
  if (night.venueId) return ROUTES.VENUE(night.venueId);
  return null;
}

/** The DJs someone rated on a night (their DJ reviews), in lineup order. */
export function ratedSets(review: Pick<Review, "lineup">): LineupEntry[] {
  return review.lineup.filter((entry) => entry.rating != null);
}

/** The one DJ a post is really about: a night logged before nights were
 * rated, with nothing said about the night itself and a single DJ rated. It
 * shows as that DJ's review. */
export function soloSet(review: Pick<Review, "rating" | "reviewText" | "lineup">): LineupEntry | null {
  if (review.rating != null || review.reviewText) return null;
  const sets = ratedSets(review);
  return sets.length === 1 ? sets[0] : null;
}

/** What a post is about, for headings and avatars: the night, titled by
 * getNightTitle - or, given `set`, that DJ. `where` is the extra context to
 * show after the name. */
export function reviewSubject(
  review: Night,
  set?: LineupEntry | null,
): {
  name: string;
  imageUrl: string | null;
  href: Href | null;
  where: string[];
  isNight: boolean;
} {
  if (set) {
    const { dj } = set;
    return { name: dj.name, imageUrl: dj.imageUrl, href: ROUTES.DJ(dj.slug), where: nightWhere(review), isNight: false };
  }
  const solo = review.lineup.length === 1 ? review.lineup[0].dj : null;
  return {
    name: getNightTitle(review),
    imageUrl: solo?.imageUrl ?? null,
    href: nightHref(review),
    where: ["Whole night", ...nightWhere(review).slice(review.event ? 1 : 0)],
    isNight: true,
  };
}
