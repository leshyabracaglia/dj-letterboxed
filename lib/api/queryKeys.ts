// Stable react-query key factories, replacing tRPC's auto-derived keys.
// Infinite queries use the base (no-cursor) key; react-query tracks pages
// internally via pageParam.
export const queryKeys = {
  appVersion: () => ["app-version"] as const,
  // The device's current place (lib/location), not an API call.
  location: () => ["location"] as const,
  djs: {
    search: (q: string) => ["djs", "search", q] as const,
    bySlug: (slug: string) => ["djs", "slug", slug] as const,
    spotifySearch: (q: string) => ["djs", "spotify-search", q] as const,
  },
  events: {
    list: (q: string) => ["events", "list", q] as const,
    bySlug: (slug: string) => ["events", "slug", slug] as const,
  },
  venues: {
    search: (q: string) => ["venues", "search", q] as const,
    byId: (id: string) => ["venues", id] as const,
    placesSearch: (q: string) => ["venues", "places-search", q] as const,
  },
  ra: {
    areas: (q: string) => ["ra", "areas", q] as const,
    // `where` is the query's area params: an areaId, or where the caller is
    // (none = the area of their latest log).
    events: (where: Record<string, string | number | undefined>, from: string, to: string) =>
      ["ra", "events", where, from, to] as const,
    match: (eventId: string) => ["ra", "match", eventId] as const,
  },
  tags: {
    list: (q: string) => ["tags", q] as const,
  },
  users: {
    me: () => ["users", "me"] as const,
    blocks: () => ["users", "me", "blocks"] as const,
    search: (q: string) => ["users", "search", q] as const,
    byUsername: (username: string) => ["users", username] as const,
    stats: (username: string) => ["users", username, "stats"] as const,
    followers: (userId: string) => ["users", userId, "followers"] as const,
    following: (userId: string) => ["users", userId, "following"] as const,
    favorites: (username: string) => ["users", username, "favorites"] as const,
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
  notifications: {
    all: () => ["notifications"] as const,
    list: () => ["notifications", "list"] as const,
    unreadCount: () => ["notifications", "unread-count"] as const,
  },
};
