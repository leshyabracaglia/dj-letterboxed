// Mirrors the JSON shapes produced by the Go API (server/internal/httpapi).
// Dates arrive as RFC3339 strings, not Date objects (plain JSON, no
// superjson) - callers already wrap them in `new Date(...)` where needed.

export type CrowdVibe = "electric" | "good" | "average" | "dead";

export type User = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Dj = {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  genres: string[] | null;
  imageUrl: string | null;
  spotifyId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Event = {
  id: string;
  name: string;
  venue: string;
  city: string | null;
  eventDate: string;
  description: string | null;
  createdByUserId: string | null;
  createdAt: string;
};

export type Review = {
  id: string;
  userId: string;
  djId: string;
  eventId: string | null;
  ratingHalfStars: number | null;
  reviewText: string | null;
  crowdVibe: CrowdVibe | null;
  crowdVibeNote: string | null;
  seenAt: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
  dj?: Dj;
  event?: Event;
  taggedUsers?: User[];
  likeCount?: number;
  commentCount?: number;
  isLikedByMe?: boolean;
  isPopular?: boolean;
};

export type ReviewComment = {
  id: string;
  reviewId: string;
  userId: string;
  body: string;
  createdAt: string;
  user?: User;
};

export type SpotifyArtist = {
  spotifyId: string;
  name: string;
  imageUrl: string | null;
  genres: string[];
};

export type Paginated<T> = {
  items: T[];
  nextCursor: string | null;
};

export type DjDetail = {
  dj: Dj;
  avgRating: number | null;
  logCount: number;
  recentLogs: Review[];
};

export type EventDetail = {
  event: Event;
  logs: Review[];
};

export type UserProfile = {
  user: User;
  logCount: number;
  followerCount: number;
  followingCount: number;
};

export type UserStats = {
  totalLogs: number;
  uniqueDjs: number;
  topDjs: { dj: Dj; logCount: number }[];
  topVenues: { venue: string; logCount: number }[];
};

export type LeaderboardEntry = {
  user: User;
  logCount: number;
};

export type FeedResponse = {
  items: Review[];
  nextCursor: string | null;
  followingCount: number;
};

export type PopularResponse = {
  items: Review[];
};

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
  ratingHalfStars?: number;
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
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
};
