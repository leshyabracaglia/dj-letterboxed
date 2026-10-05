import type { Href } from "expo-router";

import type { Dj, Event } from "./api/types";
import { ROUTES } from "./routes";

// Event name then venue, skipping blanks and a venue that just repeats the
// event name (common for one-off nights named after the club).
function seenWhere(event: Event | null | undefined): string[] {
  if (!event) return [];
  const parts = [event.name, event.venue].filter((p): p is string => !!p?.trim());
  return parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()
    ? [parts[0]]
    : parts;
}

/** What a review is about, for headings and avatars: its DJ, or - for a
 * review of the night as a whole (no DJ) - the night itself. `where` is
 * the extra context to show after the name. */
export function reviewSubject(review: { dj?: Dj | null; event?: Event | null }): {
  name: string;
  imageUrl: string | null;
  href: Href | null;
  where: string[];
  isNight: boolean;
} {
  const { dj, event } = review;
  if (dj) {
    return { name: dj.name, imageUrl: dj.imageUrl, href: ROUTES.DJ(dj.slug), where: seenWhere(event), isNight: false };
  }
  if (event) {
    return {
      name: event.name,
      imageUrl: null,
      href: ROUTES.EVENT(event.id),
      where: ["Whole night", ...seenWhere(event).slice(1)],
      isNight: true,
    };
  }
  return { name: "Unknown DJ", imageUrl: null, href: null, where: [], isNight: false };
}
