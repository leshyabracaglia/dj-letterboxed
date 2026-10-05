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
export type Event = Schemas["Event"];
/** A recurring event ("Innervisions") that nights at different venues and
 * dates belong to. */
export type EventSeries = Schemas["EventSeries"];
/** The flattened review shape most endpoints return: review fields plus
 * optional user/dj/event relations and engagement counts. `djId` (and so
 * `dj`) is null for a review of the night as a whole - swag can't express
 * that nullability, so it's corrected here. */
export type Review = Omit<Schemas["ReviewDTO"], "djId"> & { djId: string | null };
export type ReviewComment = Schemas["ReviewComment"];
export type SpotifyArtist = Schemas["SpotifyArtist"];
export type PlaceSuggestion = Schemas["PlaceSuggestion"];
export type TagSummary = Schemas["TagSummary"];

export type Paginated<T> = {
  items: T[];
  nextCursor: string | null;
};

export type DjDetail = Schemas["DjDetailResponse"];
// `series`/`avgRating` corrected to nullable, as with Review.djId above.
export type EventDetail = Omit<Schemas["EventDetailResponse"], "series" | "reviews"> & {
  series: EventSeries | null;
  reviews: Review[];
};
export type SeriesSummary = Omit<Schemas["SeriesSummary"], "avgRating"> & { avgRating: number | null };
export type SeriesNight = Omit<Schemas["SeriesNight"], "avgRating"> & { avgRating: number | null };
export type SeriesDetail = Omit<Schemas["SeriesDetailResponse"], "series" | "nights" | "recentReviews"> & {
  series: SeriesSummary;
  nights: SeriesNight[];
  recentReviews: Review[];
};
export type NightLogResponse = Omit<Schemas["NightLogResponse"], "series" | "reviews"> & {
  series: EventSeries | null;
  reviews: (Omit<Schemas["Review"], "djId"> & { djId: string | null })[];
};
export type VenueSummary = Schemas["VenueSummary"];
export type VenueDetail = Schemas["VenueDetailResponse"];
export type UserProfile = Schemas["UserProfileResponse"];
export type UserStats = Schemas["UserStatsResponse"];
export type LeaderboardEntry = Schemas["LeaderboardEntry"];
export type FeedResponse = Schemas["FeedResponse"];
export type PopularResponse = Schemas["PopularResponse"];
export type AppVersion = Schemas["AppVersionResponse"];
export type FavoriteReviewsResponse = Schemas["FavoriteReviewsResponse"];

// Request bodies

/** The venue goes in one of three ways, checked in this order: `venueId`
 * (a saved venue), `placeId` (a Google Places result, saved as a venue on
 * first use - send the autocomplete session token with it), or `venue` (a
 * typed-in name). */
export type CreateEventInput = {
  name: string;
  venueId?: string;
  placeId?: string;
  placeSessionToken?: string;
  venue?: string;
  city?: string;
  eventDate: string;
  description?: string;
};


/** One night out (POST /logs): the series by `seriesId` or `seriesName`
 * (neither = a night at the venue with no event name), the venue as in
 * CreateEventInput, the DJs seen, and the reviews - `night` is required
 * unless `djReviews` has one. Tags and tagged friends go on the night
 * review, or on each DJ review when there's no night review. */
export type CreateNightLogInput = {
  seriesId?: string;
  seriesName?: string;
  venueId?: string;
  placeId?: string;
  placeSessionToken?: string;
  venue?: string;
  city?: string;
  seenAt: string;
  lineupDjIds: string[];
  night?: { rating: number; reviewText?: string };
  djReviews: { djId: string; rating: number; reviewText?: string }[];
  tags: string[];
  taggedUserIds: string[];
};

/** Ordered review ids to showcase on the caller's profile, #1 favorite
 * first - at most 3, no duplicates, each must be a review the caller owns.
 * Always a full replace (an empty array clears the showcase). */
export type SetFavoritesInput = {
  reviewIds: string[];
};
