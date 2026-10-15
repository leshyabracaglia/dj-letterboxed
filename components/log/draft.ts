import type { Dj, EventSummary, PlaceSuggestion, RAEventMatch, Review, User, VenueSummary } from "../../lib/api/types";
import { parseDateInputValue, plural, toDateInputValue } from "../../lib/format";

// The log screen's form model: what's picked and typed so far, and the
// helpers that name and fill it in.

export type ICreateDjInput = {
  name: string;
  bio?: string;
  genres?: string[];
  spotifyId?: string;
  imageUrl?: string | null;
};

// An already-saved DJ, or one (from Spotify or typed in by hand) that gets
// created when the night is saved.
export type IArtistPick = { type: "existing"; dj: Dj } | { type: "new"; input: ICreateDjInput };

// One DJ in the night's lineup. Rating them is optional; an unrated DJ is
// still saved to the lineup.
export type ILineupEntry = {
  key: string;
  pick: IArtistPick;
  rating?: number;
  reviewText: string;
  // Their review box is open.
  reviewing: boolean;
  // On the log. A lineup filled in for you (from Resident Advisor, or the
  // night you were tagged in) starts unticked until you say which sets you
  // caught; DJs you add yourself are caught.
  caught: boolean;
  listed?: boolean;
};

// An existing event ("Innervisions NY"), a new one created by name when the
// night is saved, or (none) a night with no name, just the venue.
export type IEventPick = { type: "existing"; event: EventSummary } | { type: "new"; name: string } | { type: "none" };

// An already-saved venue, a Google Places result (saved as a venue when the
// night is saved, in the billing session it was found in), or a name typed in
// by hand. Saved and Google venues already know their city.
export type IVenuePick =
  | { type: "existing"; venue: VenueSummary }
  | { type: "place"; place: PlaceSuggestion; sessionToken: string }
  | { type: "typed"; name: string; city: string };

// Form fields as typed; turned into the POST /logs body on submit. rating,
// tags and reviewText are the review of the night as a whole.
export type IReviewDraft = {
  // Unset until they name the night or pick "no name".
  eventPick?: IEventPick;
  venuePick?: IVenuePick;
  seenAt: string;
  isDay: boolean;
  isNight: boolean;
  rating?: number;
  tags: string[];
  reviewText: string;
  taggedUsers: User[];
};

// Which slot of the poster is being edited in a sheet.
export type ISheet = "event" | "date" | "venue";

export function emptyDraft(): IReviewDraft {
  return {
    seenAt: toDateInputValue(new Date()),
    isDay: false,
    isNight: true,
    tags: [],
    reviewText: "",
    taggedUsers: [],
  };
}

export function artistPickName(pick: IArtistPick) {
  return pick.type === "existing" ? pick.dj.name : pick.input.name;
}

export function artistPickKey(pick: IArtistPick) {
  if (pick.type === "existing") return `dj-${pick.dj.id}`;
  return pick.input.spotifyId ? `spotify-${pick.input.spotifyId}` : `new-${pick.input.name.toLowerCase()}`;
}

export function eventPickName(pick: IEventPick | undefined) {
  if (pick?.type === "existing") return pick.event.name;
  if (pick?.type === "new") return pick.name;
  return undefined;
}

export function nightsLogged(count: number) {
  return `${plural(count, "night")} logged`;
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// "Sat 3 Oct", in the device locale's names.
export function shortDayLabel(date: Date) {
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
  const month = date.toLocaleDateString(undefined, { month: "short" });
  return `${weekday} ${date.getDate()} ${month}`;
}

export function venuePickName(pick: IVenuePick) {
  if (pick.type === "existing") return pick.venue.name;
  if (pick.type === "place") return pick.place.name;
  return pick.name;
}

export function venuePickSubtitle(pick: IVenuePick) {
  if (pick.type === "existing") return pick.venue.city || pick.venue.address || "";
  if (pick.type === "place") return pick.place.secondaryText;
  return pick.city;
}

// What the typed text could seed a blank poster as.
export type IBlankSeed = { type: "event" | "dj" | "venue"; text: string } | undefined;

// The poster's starting point for an RA night, from its match: the party
// name (or none, headed by the venue), venue, day, day/night, and the lineup
// to tick off.
export function draftFromRA(match: RAEventMatch): { draft: IReviewDraft; lineup: ILineupEntry[] } {
  const { venue } = match;
  const venuePick: IVenuePick | undefined = venue.venue
    ? { type: "existing", venue: venue.venue }
    : venue.place
      ? { type: "place", place: venue.place, sessionToken: venue.placeSessionToken }
      : venue.name
        ? { type: "typed", name: venue.name, city: venue.city }
        : undefined;
  const lineup: ILineupEntry[] = [];
  for (const artist of match.lineup) {
    const pick: IArtistPick = artist.dj
      ? { type: "existing", dj: artist.dj }
      : artist.spotify
        ? {
            type: "new",
            input: {
              name: artist.spotify.name,
              spotifyId: artist.spotify.spotifyId,
              imageUrl: artist.spotify.imageUrl ?? undefined,
              genres: artist.spotify.genres,
            },
          }
        : { type: "new", input: { name: artist.name } };
    const key = artistPickKey(pick);
    if (lineup.some((e) => e.key === key)) continue;
    lineup.push({ key, pick, reviewText: "", reviewing: false, caught: false, listed: true });
  }
  return {
    draft: {
      ...emptyDraft(),
      eventPick: match.eventName ? { type: "new", name: match.eventName } : { type: "none" },
      venuePick,
      // RA lists upcoming nights too; a night that hasn't happened can't be
      // logged, so those land on today for the person to fix.
      seenAt: match.seenAt > toDateInputValue(new Date()) ? toDateInputValue(new Date()) : match.seenAt,
      isDay: match.isDay,
      isNight: match.isNight || !match.isDay,
    },
    lineup,
  };
}

// The poster's starting point for a night someone tagged you in: their
// event, venue, day and day/night, their lineup to tick off, and them (and
// whoever else they tagged) as who you went with.
export function draftFromReview(
  review: Review,
  venue: VenueSummary | undefined,
  myId: string,
): { draft: IReviewDraft; lineup: ILineupEntry[] } {
  const venuePick: IVenuePick | undefined = venue
    ? { type: "existing", venue }
    : review.venue
      ? { type: "typed", name: review.venue, city: review.city ?? "" }
      : undefined;
  const lineup: ILineupEntry[] = review.lineup.map(({ dj }) => {
    const pick: IArtistPick = { type: "existing", dj };
    return { key: artistPickKey(pick), pick, reviewText: "", reviewing: false, caught: false, listed: true };
  });
  const friends = [...(review.user ? [review.user] : []), ...review.taggedUsers].filter(
    (u, i, all) => u.id !== myId && all.findIndex((other) => other.id === u.id) === i,
  );
  return {
    draft: {
      ...emptyDraft(),
      // By name: the server finds the existing event.
      eventPick: review.event ? { type: "new", name: review.event.name } : { type: "none" },
      venuePick,
      seenAt: toDateInputValue(new Date(review.seenAt)),
      isDay: review.isDay,
      isNight: review.isNight || !review.isDay,
      taggedUsers: friends,
    },
    lineup,
  };
}

// What stops the draft being logged, if anything. A missing venue or night
// rating is flagged on the form itself (`field`); the rest is a message.
export function draftProblem(
  draft: IReviewDraft,
  caught: ILineupEntry[],
): { field?: "venue" | "night"; message?: string } | undefined {
  if (!draft.venuePick) return { field: "venue" };
  if (!parseDateInputValue(draft.seenAt)) return { message: "Pick the date you went" };
  // The calendar disables future days; this is a backstop. YYYY-MM-DD
  // strings compare correctly as plain strings.
  if (draft.seenAt > toDateInputValue(new Date())) return { message: "You can't log a set that hasn't happened yet" };
  if (!draft.isDay && !draft.isNight) return { message: "Pick day, night, or both" };
  if (!draft.rating) return { field: "night", message: "Rate the night overall" };
  const unratedWithText = caught.find((e) => !e.rating && e.reviewText.trim());
  if (unratedWithText) {
    return { message: `Rate ${artistPickName(unratedWithText.pick)} to save what you wrote about them` };
  }
  return undefined;
}
