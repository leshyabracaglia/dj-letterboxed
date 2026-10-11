// Response types are aliased from lib/api/generated.ts, which is
// generated (not hand-written) from the Go API's OpenAPI spec - itself
// generated from @-annotations on each handler in server/internal/httpapi.
// Regenerate both after changing a handler: `npm run codegen:api-types`
// (see scripts/generate-api-types.sh). Request body types stay hand-written
// below - lower drift risk since adding a new one touches both ends at once,
// and OpenAPI's json-schema request shapes don't carry TS's optional-vs-
// omitted distinction cleanly (see taggedUserIds in app/(tabs)/review.tsx).
//
// Dates arrive as RFC3339 strings, not Date objects (plain JSON, no
// superjson) - callers already wrap them in `new Date(...)` where needed.

import type { components } from "./generated";

type Schemas = components["schemas"];

export type User = Schemas["User"];
export type Dj = Schemas["Dj"];
/** A named party ("Innervisions NY"): it can happen at many venues on many
 * dates, and collects every log of it. */
export type Event = Schemas["Event"];
/** One person's night out: its event (null for a night with no event name),
 * venue, day, day/night and the DJs they saw. `venue`/`venueId` are null
 * only on old logs migrated from reviews that had no night - swag can't
 * express these nullabilities, so they're corrected here. */
export type Log = Omit<Schemas["LogDTO"], "event" | "eventId" | "venue" | "venueId"> & {
  event: Event | null;
  eventId: string | null;
  venue: string | null;
  venueId: string | null;
};
/** The flattened review shape most endpoints return: review fields plus
 * optional user/dj/log relations and engagement counts. `djId` (and so
 * `dj`) is null for a review of the night as a whole. */
export type Review = Omit<Schemas["ReviewDTO"], "djId" | "log"> & { djId: string | null; log?: Log };
/** One DJ's review inside a night-out post (`Review.djReviews`). */
export type DjReview = Schemas["DjReviewDTO"];
export type ReviewComment = Schemas["ReviewComment"];
export type SpotifyArtist = Schemas["SpotifyArtist"];
export type PlaceSuggestion = Schemas["PlaceSuggestion"];
export type TagSummary = Schemas["TagSummary"];

export type Paginated<T> = {
  items: T[];
  nextCursor: string | null;
};

export type DjDetail = Schemas["DjDetailResponse"];
// `avgRating` corrected to nullable (an event with no ratings yet).
export type EventSummary = Omit<Schemas["EventSummary"], "avgRating"> & { avgRating: number | null };
export type EventDetail = Omit<Schemas["EventDetailResponse"], "event" | "recentReviews"> & {
  event: EventSummary;
  recentReviews: Review[];
};
export type NightLogResponse = Omit<Schemas["NightLogResponse"], "event" | "reviews"> & {
  event: Event | null;
  reviews: (Omit<Schemas["Review"], "djId"> & { djId: string | null })[];
};
export type VenueSummary = Schemas["VenueSummary"];
export type VenueDetail = Omit<Schemas["VenueDetailResponse"], "recentReviews"> & { recentReviews: Review[] };
export type UserProfile = Schemas["UserProfileResponse"];
export type UserStats = Schemas["UserStatsResponse"];
export type LeaderboardEntry = Schemas["LeaderboardEntry"];
export type FeedResponse = Schemas["FeedResponse"];
export type PopularResponse = Schemas["PopularResponse"];
export type AppVersion = Schemas["AppVersionResponse"];
export type FavoriteReviewsResponse = Schemas["FavoriteReviewsResponse"];
/** A Resident Advisor area (a city or region), whose listings the log
 * screen searches. */
export type RAArea = Schemas["RAArea"];
/** A night listed on Resident Advisor. `startTime`/`endTime` are local
 * wall-clock times with no zone. */
export type RAEvent = Omit<Schemas["RAEvent"], "flyerUrl"> & { flyerUrl: string | null };
export type RAEventsResponse = { area: RAArea | null; events: RAEvent[] };
/** An RA night turned into a log to fill in: the lineup matched to
 * Beatboxd DJs (`dj`) or Spotify artists (`spotify`) - neither means it's
 * added by name - and the venue matched to a saved venue (`venue`) or a
 * Google place (`place`, saved with `placeSessionToken`), else `name`/`city`
 * to add by hand. `eventName` is null for a night with no party name. */
export type RAEventMatch = Omit<Schemas["RAEventMatchResponse"], "event" | "eventName" | "venue" | "lineup"> & {
  event: RAEvent;
  eventName: string | null;
  venue: Omit<Schemas["RAVenueMatch"], "venue" | "place"> & {
    venue: VenueSummary | null;
    place: PlaceSuggestion | null;
  };
  lineup: { name: string; dj: Dj | null; spotify: SpotifyArtist | null }[];
};
export type UpdateNightLogResponse = Schemas["UpdateNightLogResponse"];

// Request bodies

/** One night out (POST /logs): the event by `eventId` or `eventName` (found
 * or created by name; neither = a night with no event name), the venue -
 * `venueId` (a saved venue), `placeId` (a Google Places result, saved on
 * first use; send the autocomplete session token with it), or `venue` (a
 * typed-in name), checked in that order - the day, the DJs seen, and the
 * reviews: `night` (required) and any `djReviews`. Tags and tagged friends
 * go on the night review. */
export type CreateNightLogInput = {
  eventId?: string;
  eventName?: string;
  venueId?: string;
  placeId?: string;
  placeSessionToken?: string;
  venue?: string;
  city?: string;
  seenAt: string;
  /** When you went: day, night, or both. Neither means night. */
  isDay?: boolean;
  isNight?: boolean;
  lineupDjIds: string[];
  night: { rating: number; reviewText?: string };
  djReviews: { djId: string; rating: number; reviewText?: string }[];
  tags: string[];
  taggedUserIds: string[];
};

/** PATCH /logs/{id}: a log is fixed once logged except for who you tagged
 * as being there; this replaces them ([] clears). */
export type UpdateNightLogInput = { taggedUserIds: string[] };

/** Ordered review ids to showcase on the caller's profile, #1 favorite
 * first - at most 3, no duplicates, each must be a review the caller owns.
 * Always a full replace (an empty array clears the showcase). */
export type SetFavoritesInput = {
  reviewIds: string[];
};

/** POST/DELETE /users/me/push-tokens: this device's Expo push token. */
export type PushTokenInput = { token: string; platform: string };
