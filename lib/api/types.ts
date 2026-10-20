// Response types are aliased from lib/api/generated.ts, which is
// generated (not hand-written) from the Go API's OpenAPI spec - itself
// generated from @-annotations on each handler in server/internal/httpapi.
// Regenerate both after changing a handler: `npm run codegen:api-types`
// (see scripts/generate-api-types.sh). Fields are required unless the Go
// struct says otherwise: `omitempty` for an optional request field,
// `extensions:"x-nullable"` for a response field that can be null.
//
// Dates arrive as RFC3339 strings, not Date objects (plain JSON) -
// callers already wrap them in `new Date(...)` where needed.

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
/** A review fetched by id (GET /reviews/{id}), which always includes who
 * posted it. */
export type ReviewDetail = Review & { user: User };
/** A DJ seen on a night, with `rating`/`reviewText` when they were rated
 * (a DJ review). */
export type LineupEntry = Schemas["LineupEntry"];
export type ReviewComment = Schemas["ReviewComment"];
export type PlaceSuggestion = Schemas["PlaceSuggestion"];

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
export type FavoriteReviewsResponse = Schemas["FavoriteReviewsResponse"];
/** A Resident Advisor area (a city or region), whose listings the log
 * screen searches. */
export type RAArea = Schemas["RAArea"];
/** A night listed on Resident Advisor. `startTime`/`endTime` are local
 * wall-clock times with no zone. */
export type RAEvent = Schemas["RAEvent"];
/** An RA night turned into a log to fill in: the lineup matched to
 * Beatboxd DJs (`dj`) or Spotify artists (`spotify`) - neither means it's
 * added by name - and the venue matched to a saved venue (`venue`) or a
 * Google place (`place`, saved with `placeSessionToken`), else `name`/`city`
 * to add by hand. `eventName` is null for a night with no party name. */
export type RAEventMatch = Schemas["RAEventMatchResponse"];
/** Something that happened on the caller's account. `reviewId`/`subject`
 * (the night's title) are null on follows, `commentBody` on everything but
 * comments. */
export type Notification = Schemas["Notification"];
export type UnreadNotificationsResponse = Schemas["UnreadNotificationsResponse"];
/** A venue the caller is at (GET /check-ins/nearby), or just checked in at. */
export type NearbyVenue = Schemas["NearbyVenue"];

// Request bodies, from the spec too. A few are narrowed by hand where the
// spec can't say "exactly one of": the narrowing still has to fit the spec's
// shape, since each call's body is checked against it.

/** One night out (POST /reviews): the event by `eventId` or `eventName`
 * (found or created by name; neither = a night with no event name), the
 * venue - `venueId` (a saved venue), `placeId` (a Google Places result, saved
 * on first use; send the autocomplete session token with it), or `venue` (a
 * typed-in name), checked in that order - the day and day/night (neither
 * means night), the night's `rating` and review, the DJs seen (rate one to
 * review their set; text needs a rating), tags and tagged friends. */
export type CreateReviewInput = Schemas["createReviewRequest"];

/** PATCH /reviews/{id}: a review is fixed once logged except for who you
 * tagged as being there; this replaces them ([] clears). */
export type UpdateReviewInput = Schemas["updateReviewRequest"];

/** POST /djs: an artist from Spotify or typed in by hand. */
export type CreateDjInput = Schemas["createDjRequest"];

/** PATCH /users/me: the profile fields to change; omitted ones stay. */
export type UpdateProfileInput = Schemas["updateProfileRequest"];

/** Ordered review ids (nights) to showcase on the caller's profile, #1 favorite
 * first - at most 3, no duplicates, each must be a review the caller owns.
 * Always a full replace (an empty array clears the showcase). */
export type SetFavoritesInput = Schemas["setFavoritesRequest"];

export type ReportReason = "spam" | "harassment" | "hate" | "sexual" | "violence" | "other";

/** POST /reports: exactly one review, comment or user, and why. */
export type CreateReportInput = ({ reviewId: string } | { commentId: string } | { userId: string }) & {
  reason: ReportReason;
};

/** A place to check in at: a saved venue, or a Google place from
 * GET /check-ins/nearby (saved as a venue on check-in). */
export type CheckInPlace = { venueId: string } | { placeId: string };

/** Checking in (POST /check-ins): exactly one place, where the device is, and
 * how accurate the fix is in meters. Only the distance to the venue is
 * stored. */
export type CheckInInput = CheckInPlace & Omit<Schemas["checkInRequest"], "venueId" | "placeId">;

/** PATCH /users/me/settings: the settings to change; omitted ones stay. */
export type UpdateSettingsInput = Schemas["updateSettingsRequest"];

/** POST/DELETE /users/me/push-tokens: this device's Expo push token. */
export type PushTokenInput = Schemas["pushTokenRequest"];
