// Builders for API objects in unit tests: a valid default, overridden by
// whatever the test is about.
import type { Dj, Event, LineupEntry, Review, User } from "@/lib/api/types";

const AT = "2026-09-14T12:00:00Z";

export function aUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    username: "raver",
    displayName: null,
    avatarUrl: null,
    bio: null,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

export function aDj(overrides: Partial<Dj> = {}): Dj {
  const name = overrides.name ?? "Dixon";
  return {
    id: `dj-${name.toLowerCase()}`,
    name,
    slug: name.toLowerCase(),
    bio: null,
    genres: [],
    imageUrl: null,
    spotifyId: null,
    createdByUserId: null,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

export function anEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "event-1",
    name: "Innervisions NY",
    slug: "innervisions-ny",
    createdByUserId: null,
    createdAt: AT,
    ...overrides,
  };
}

/** A lineup entry for each name; pass `{ name, reviewText }` to write about
 * one's set. */
export function aLineup(...djs: (string | { name: string; reviewText?: string })[]): LineupEntry[] {
  return djs.map((dj) => {
    const { name, reviewText } = typeof dj === "string" ? { name: dj } : dj;
    return { dj: aDj({ name }), reviewText: reviewText ?? null };
  });
}

export function aReview(overrides: Partial<Review> = {}): Review {
  return {
    id: "review-1",
    userId: "user-1",
    event: null,
    eventId: null,
    venue: "Basement",
    venueId: "venue-1",
    city: "New York",
    seenAt: AT,
    isDay: false,
    isNight: true,
    reviewText: null,
    lineup: [],
    tracks: [],
    tags: [],
    taggedUsers: [],
    likeCount: 0,
    commentCount: 0,
    isLikedByMe: false,
    verified: false,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}
