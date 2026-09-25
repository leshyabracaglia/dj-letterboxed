// Response types are aliased from lib/api/generated.ts, which is
// generated (not hand-written) from the Go API's OpenAPI spec - itself
// generated from @-annotations on each handler in server/internal/httpapi.
// Regenerate both after changing a handler: `npm run codegen:api-types`
// (see scripts/generate-api-types.sh). Request body types stay hand-written
// below - lower drift risk since adding a new one touches both ends at once,
// and OpenAPI's json-schema request shapes don't carry TS's optional-vs-
// omitted distinction cleanly (see taggedUserIds below).
//
// Dates arrive as RFC3339 strings, not Date objects (plain JSON, no
// superjson) - callers already wrap them in `new Date(...)` where needed.

import type { components } from "./generated";

type Schemas = components["schemas"];

export type CrowdVibe = Schemas["CrowdVibe"];
export type User = Schemas["User"];
export type Dj = Schemas["Dj"];
export type Event = Schemas["Event"];
/** The flattened review shape most endpoints return: review fields plus
 * optional user/dj/event relations and engagement counts. */
export type Review = Schemas["ReviewDTO"];
export type ReviewComment = Schemas["ReviewComment"];
export type SpotifyArtist = Schemas["SpotifyArtist"];

export type Paginated<T> = {
  items: T[];
  nextCursor: string | null;
};

export type DjDetail = Schemas["DjDetailResponse"];
export type EventDetail = Schemas["EventDetailResponse"];
export type VenueSummary = Schemas["VenueSummary"];
export type VenueDetail = Schemas["VenueDetailResponse"];
export type UserProfile = Schemas["UserProfileResponse"];
export type UserStats = Schemas["UserStatsResponse"];
export type LeaderboardEntry = Schemas["LeaderboardEntry"];
export type FeedResponse = Schemas["FeedResponse"];
export type PopularResponse = Schemas["PopularResponse"];
export type FavoriteReviewsResponse = Schemas["FavoriteReviewsResponse"];

// Request bodies

export type CreateDjInput = {
  name: string;
  bio?: string;
  genres?: string[];
  spotifyId?: string;
  imageUrl?: string;
};

export type CreateEventInput = {
  name: string;
  venue: string;
  city?: string;
  eventDate: string;
  description?: string;
};

export type CreateReviewInput = {
  djId: string;
  eventId?: string;
  rating?: number;
  reviewText?: string;
  crowdVibe?: CrowdVibe;
  crowdVibeNote?: string;
  seenAt: string;
  taggedUserIds?: string[];
};

export type UpdateReviewInput = Partial<Omit<CreateReviewInput, "djId">> & {
  id: string;
};

export type UpdateProfileInput = {
  username?: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
};

/** Ordered review ids to showcase on the caller's profile, #1 favorite
 * first - at most 3, no duplicates, each must be a review the caller owns.
 * Always a full replace (an empty array clears the showcase). */
export type SetFavoritesInput = {
  reviewIds: string[];
};
