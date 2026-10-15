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
 * dates, and collects every review of it. */
export type Event = Schemas["Event"];
/** One person's night out, and the post: its event (null for a night with
 * no event name), venue, day and day/night, their rating and review of the
 * night, the DJs they saw (`lineup`, each with their review of that DJ's set
 * if they rated it), tags, tagged friends, likes and comments. `rating` is
 * null only on nights logged before nights were rated; `venue`/`venueId`
 * only on nights migrated from reviews that never had one. */
export type Review = Schemas["ReviewDTO"];
/** A DJ seen on a night, with `rating`/`reviewText` when they were rated
 * (a DJ review). */
export type LineupEntry = Schemas["LineupEntry"];
export type ReviewComment = Schemas["ReviewComment"];
export type SpotifyArtist = Schemas["SpotifyArtist"];
export type PlaceSuggestion = Schemas["PlaceSuggestion"];
export type TagSummary = Schemas["TagSummary"];

export type Paginated<T> = {
  items: T[];
  nextCursor: string | null;
};

export type DjDetail = Schemas["DjDetailResponse"];
/** `avgRating` is null for an event with no ratings yet. */
export type EventSummary = Schemas["EventSummary"];
export type EventDetail = Schemas["EventDetailResponse"];
export type VenueSummary = Schemas["VenueSummary"];
export type VenueDetail = Schemas["VenueDetailResponse"];
export type UserProfile = Schemas["UserProfileResponse"];
export type UserStats = Schemas["UserStatsResponse"];
export type FeedResponse = Schemas["FeedResponse"];
export type PopularResponse = Schemas["PopularResponse"];
export type AppVersion = Schemas["AppVersionResponse"];
export type FavoriteReviewsResponse = Schemas["FavoriteReviewsResponse"];
/** A Resident Advisor area (a city or region), whose listings the log
 * screen searches. */
export type RAArea = Schemas["RAArea"];
/** A night listed on Resident Advisor. `startTime`/`endTime` are local
 * wall-clock times with no zone. */
export type RAEvent = Schemas["RAEvent"];
export type RAEventsResponse = Schemas["RAEventsResponse"];
/** An RA night turned into a log to fill in: the lineup matched to
 * Beatboxd DJs (`dj`) or Spotify artists (`spotify`) - neither means it's
 * added by name - and the venue matched to a saved venue (`venue`) or a
 * Google place (`place`, saved with `placeSessionToken`), else `name`/`city`
 * to add by hand. `eventName` is null for a night with no party name. */
export type RAEventMatch = Schemas["RAEventMatchResponse"];
export type UpdateReviewResponse = Schemas["UpdateReviewResponse"];
/** Something that happened on the caller's account. `reviewId`/`subject`
 * (the night's title) are null on follows, `commentBody` on everything but
 * comments. */
export type Notification = Omit<Schemas["Notification"], "reviewId" | "subject" | "commentBody"> & {
  reviewId: string | null;
  subject: string | null;
  commentBody: string | null;
};
export type NotificationsResponse = { items: Notification[]; nextCursor: string | null };
export type UnreadNotificationsResponse = Schemas["UnreadNotificationsResponse"];
/** A venue the caller is at (GET /check-ins/nearby), or just checked in at. */
export type NearbyVenue = Schemas["NearbyVenue"];
export type NearbyVenuesResponse = Schemas["NearbyVenuesResponse"];
export type CheckInResponse = Schemas["CheckInResponse"];

// Request bodies

/** One night out (POST /reviews): the event by `eventId` or `eventName`
 * (found or created by name; neither = a night with no event name), the
 * venue - `venueId` (a saved venue), `placeId` (a Google Places result, saved
 * on first use; send the autocomplete session token with it), or `venue` (a
 * typed-in name), checked in that order - the day, the night's `rating`
 * (required) and review, the DJs seen (rate one to review their set; text
 * needs a rating), tags and tagged friends. */
export type CreateReviewInput = {
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
  rating: number;
  reviewText?: string;
  lineup: { djId: string; rating?: number; reviewText?: string }[];
  tags: string[];
  taggedUserIds: string[];
};

/** PATCH /reviews/{id}: a review is fixed once logged except for who you
 * tagged as being there; this replaces them ([] clears). */
export type UpdateReviewInput = { taggedUserIds: string[] };

/** Ordered review ids (nights) to showcase on the caller's profile, #1 favorite
 * first - at most 3, no duplicates, each must be a review the caller owns.
 * Always a full replace (an empty array clears the showcase). */
export type SetFavoritesInput = {
  reviewIds: string[];
};

export type ReportReason = "spam" | "harassment" | "hate" | "sexual" | "violence" | "other";

/** POST /reports: one review, comment or user, and why. */
export type CreateReportInput = ({ reviewId: string } | { commentId: string } | { userId: string }) & {
  reason: ReportReason;
};

/** POST/DELETE /users/me/push-tokens: this device's Expo push token. */
/** Checking in (POST /check-ins): where the device is, and how accurate the
 * fix is in meters. Only the distance to the venue is stored. */
export type CheckInInput = { venueId: string; latitude: number; longitude: number; accuracyM?: number };
export type PushTokenInput = { token: string; platform: string };
