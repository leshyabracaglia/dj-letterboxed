// Stable react-query key factories, replacing tRPC's auto-derived keys.
// Infinite queries use the base (no-cursor) key; react-query tracks pages
// internally via pageParam.
export const queryKeys = {
  djs: {
    search: (q: string) => ["djs", "search", q] as const,
    bySlug: (slug: string) => ["djs", "slug", slug] as const,
    spotifySearch: (q: string) => ["djs", "spotify-search", q] as const,
    reviews: (djId: string) => ["djs", djId, "reviews"] as const,
  },
  events: {
    search: (q: string) => ["events", "search", q] as const,
    byId: (id: string) => ["events", id] as const,
  },
  users: {
    me: () => ["users", "me"] as const,
    search: (q: string) => ["users", "search", q] as const,
    byUsername: (username: string) => ["users", username] as const,
    stats: (username: string) => ["users", username, "stats"] as const,
    leaderboard: () => ["leaderboard"] as const,
    followers: (userId: string) => ["users", userId, "followers"] as const,
    following: (userId: string) => ["users", userId, "following"] as const,
  },
  follows: {
    isFollowing: (userId: string) => ["follows", "is-following", userId] as const,
  },
  reviews: {
    byId: (id: string) => ["reviews", id] as const,
    byUser: (username: string) => ["reviews", "user", username] as const,
    comments: (reviewId: string) => ["reviews", reviewId, "comments"] as const,
  },
  feed: {
    activity: () => ["feed"] as const,
    popular: () => ["feed", "popular"] as const,
  },
};
