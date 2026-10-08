import type { Href } from "expo-router";

import type { Dj, Log } from "./api/types";
import { ROUTES } from "./routes";

/** Where a night was: its event name then venue, skipping blanks and a
 * venue that just repeats the event name. */
export function logWhere(log: Log | null | undefined): string[] {
  if (!log) return [];
  const parts = [log.event?.name, log.venue].filter((p): p is string => !!p?.trim());
  return parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()
    ? [parts[0]]
    : parts;
}

/** Where a night links to: its event page, or its venue's when it has no
 * event name. */
export function logHref(log: Log | null | undefined): Href | null {
  if (log?.event) return ROUTES.EVENT(log.event.slug);
  if (log?.venueId) return ROUTES.VENUE(log.venueId);
  return null;
}

/** What a review is about, for headings and avatars: its DJ, or - for a
 * review of the night as a whole (no DJ) - the night itself, named after
 * its event (or venue). `where` is the extra context to show after the
 * name. */
export function reviewSubject(review: { dj?: Dj | null; log?: Log | null }): {
  name: string;
  imageUrl: string | null;
  href: Href | null;
  where: string[];
  isNight: boolean;
} {
  const { dj, log } = review;
  if (dj) {
    return { name: dj.name, imageUrl: dj.imageUrl, href: ROUTES.DJ(dj.slug), where: logWhere(log), isNight: false };
  }
  const solo = log?.lineup.length === 1 ? log.lineup[0] : null;
  return {
    name: log?.event?.name || log?.venue || "A night out",
    imageUrl: solo?.imageUrl ?? null,
    href: logHref(log),
    where: ["Whole night", ...logWhere(log).slice(log?.event ? 1 : 2)],
    isNight: true,
  };
}
