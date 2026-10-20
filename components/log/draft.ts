import type {
  CreateDjInput,
  Dj,
  EventSummary,
  PlaceSuggestion,
  RAEventMatch,
  Review,
  TrackInput,
  TrackMatch,
  User,
  VenueSummary,
} from "@/lib/api/types";
import { parseDateInputValue, plural, toDateInputValue } from "@/lib/format";

// The log screen's form model: what's picked and typed so far, and the
// helpers that name and fill it in.

// An already-saved DJ, or one (from Spotify or typed in by hand) that gets
// created when the night is saved.
export type ArtistPick = { type: "existing"; dj: Dj } | { type: "new"; input: CreateDjInput };

// One DJ in the night's lineup. Writing about their set is optional; a DJ
// with nothing said about them is still saved to the lineup.
export type DraftLineupEntry = {
  key: string;
  pick: ArtistPick;
  reviewText: string;
  // Their review box is open.
  reviewing: boolean;
  // On the log. A lineup filled in for you (from Resident Advisor, or the
  // night you were tagged in) starts unticked until you say which sets you
  // caught; DJs you add yourself are caught.
  caught: boolean;
  listed?: boolean;
};

// The most tracks a night can have (the server's maxTracks).
export const MAX_TRACKS = 10;

// A track to highlight on the night: one found on a music service (`match`)
// or typed in (`title`/`artist`, both blank for an unidentified one, which
// then needs a note). `djKey` is the lineup entry who played it; none is a
// track from the night as a whole.
export type DraftTrack = {
  key: string;
  djKey?: string;
  match?: TrackMatch;
  title: string;
  artist: string;
  note: string;
};

// An existing event ("Innervisions NY"), a new one created by name when the
// night is saved, or (none) a night with no name, just the venue.
export type EventPick = { type: "existing"; event: EventSummary } | { type: "new"; name: string } | { type: "none" };

// An already-saved venue, a Google Places result (saved as a venue when the
// night is saved, in the billing session it was found in), or a name typed in
// by hand. Saved and Google venues already know their city.
export type VenuePick =
  | { type: "existing"; venue: VenueSummary }
  | { type: "place"; place: PlaceSuggestion; sessionToken: string }
  | { type: "typed"; name: string; city: string };

// Form fields as typed; turned into the POST /reviews body on submit. tags
// and reviewText are the review of the night as a whole.
export type ReviewDraft = {
  // Unset until they name the night or pick "no name".
  eventPick?: EventPick;
  venuePick?: VenuePick;
  seenAt: string;
  isDay: boolean;
  isNight: boolean;
  tags: string[];
  reviewText: string;
  tracks: DraftTrack[];
  taggedUsers: User[];
};

// Which slot of the poster is being edited in a sheet.
export type PosterSheet = "event" | "date" | "venue";

export function emptyDraft(): ReviewDraft {
  return {
    seenAt: toDateInputValue(new Date()),
    isDay: false,
    isNight: true,
    tags: [],
    reviewText: "",
    tracks: [],
    taggedUsers: [],
  };
}

/** The tracks to log, as the POST /reviews body takes them: a DJ's only
 * while that DJ is still ticked as caught (unticking keeps them in the draft,
 * so ticking back brings them back), with `djIdFor` giving the DJ's id. */
export function trackInputs(
  tracks: DraftTrack[],
  caught: DraftLineupEntry[],
  djIdFor: (entry: DraftLineupEntry) => string,
): TrackInput[] {
  const byKey = new Map(caught.map((e) => [e.key, e]));
  return tracks.flatMap((track) => {
    const entry = track.djKey ? byKey.get(track.djKey) : undefined;
    if (track.djKey && !entry) return [];
    const djId = entry ? djIdFor(entry) : undefined;
    const note = track.note.trim() || undefined;
    const { match } = track;
    if (match) {
      return [
        {
          djId,
          source: match.source,
          externalId: match.externalId,
          url: match.url ?? undefined,
          title: match.title,
          artist: match.artist || undefined,
          artworkUrl: match.artworkUrl ?? undefined,
          note,
        },
      ];
    }
    const title = track.title.trim() || undefined;
    if (!title && !note) return [];
    return [{ djId, source: "manual", title, artist: (title && track.artist.trim()) || undefined, note }];
  });
}

/** How many tracks would be logged (see trackInputs). */
export function trackInputCount(tracks: DraftTrack[], caught: DraftLineupEntry[]): number {
  const caughtKeys = new Set(caught.map((e) => e.key));
  return tracks.filter((t) => !t.djKey || caughtKeys.has(t.djKey)).length;
}

/** A draft track as a track row shows it. */
export function draftTrackDisplay(track: DraftTrack) {
  const { match } = track;
  return {
    source: match?.source ?? "manual",
    title: match?.title ?? (track.title.trim() || null),
    artist: match?.artist ?? (track.artist.trim() || null),
    artworkUrl: match?.artworkUrl ?? null,
    url: match?.url ?? null,
    note: track.note.trim() || null,
  };
}

export function artistPickName(pick: ArtistPick) {
  return pick.type === "existing" ? pick.dj.name : pick.input.name;
}

export function artistPickKey(pick: ArtistPick) {
  if (pick.type === "existing") return `dj-${pick.dj.id}`;
  return pick.input.spotifyId ? `spotify-${pick.input.spotifyId}` : `new-${pick.input.name.toLowerCase()}`;
}

export function eventPickName(pick: EventPick | undefined) {
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

export function venuePickName(pick: VenuePick) {
  if (pick.type === "existing") return pick.venue.name;
  if (pick.type === "place") return pick.place.name;
  return pick.name;
}

export function venuePickSubtitle(pick: VenuePick) {
  if (pick.type === "existing") return pick.venue.city || pick.venue.address || "";
  if (pick.type === "place") return pick.place.secondaryText;
  return pick.city;
}

// What the typed text could seed a blank poster as.
export type BlankSeed = { type: "event" | "dj" | "venue"; text: string } | undefined;

// The poster's starting point for an RA night, from its match: the party
// name (or none, headed by the venue), venue, day, day/night, and the lineup
// to tick off.
export function draftFromRA(match: RAEventMatch): { draft: ReviewDraft; lineup: DraftLineupEntry[] } {
  const { venue } = match;
  const venuePick: VenuePick | undefined = venue.venue
    ? { type: "existing", venue: venue.venue }
    : venue.place
      ? { type: "place", place: venue.place, sessionToken: venue.placeSessionToken }
      : venue.name
        ? { type: "typed", name: venue.name, city: venue.city }
        : undefined;
  const lineup: DraftLineupEntry[] = [];
  for (const artist of match.lineup) {
    const pick: ArtistPick = artist.dj
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
): { draft: ReviewDraft; lineup: DraftLineupEntry[] } {
  const venuePick: VenuePick | undefined = venue
    ? { type: "existing", venue }
    : review.venue
      ? { type: "typed", name: review.venue, city: review.city ?? "" }
      : undefined;
  const lineup: DraftLineupEntry[] = review.lineup.map(({ dj }) => {
    const pick: ArtistPick = { type: "existing", dj };
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

// What stops the draft being logged, if anything. A missing venue is flagged
// on the form itself (`field`); the rest is a message.
export function draftProblem(draft: ReviewDraft): { field?: "venue"; message?: string } | undefined {
  if (!draft.venuePick) return { field: "venue" };
  if (!parseDateInputValue(draft.seenAt)) return { message: "Pick the date you went" };
  // The calendar disables future days; this is a backstop. YYYY-MM-DD
  // strings compare correctly as plain strings.
  if (draft.seenAt > toDateInputValue(new Date())) return { message: "You can't log a set that hasn't happened yet" };
  if (!draft.isDay && !draft.isNight) return { message: "Pick day, night, or both" };
  return undefined;
}
