import type { QueryClient } from "@tanstack/react-query";

import type { Review, ReviewDetail, User } from "@/lib/api/types";

// Lists store reviews in different shapes (infinite-query pages, `items`,
// `recentReviews`, …), so these walk the cached data of every query a
// review's card might sit in rather than knowing each shape.

/** The query key prefixes of everything that can hold a review: the feed,
 * profiles, and DJ/event/venue pages. */
const REVIEW_LIST_PREFIXES = ["feed", "reviews", "users", "djs", "events", "venues"] as const;

// How deep the walk goes; review lists sit well within this.
const MAX_DEPTH = 6;

// A review, as opposed to the other id-carrying objects next to it (users,
// DJs, events, comments). Nothing else has both a lineup and an author.
function isReview(obj: Record<string, unknown>): boolean {
  return "lineup" in obj && "userId" in obj;
}

function isUser(obj: Record<string, unknown>): boolean {
  return typeof obj.username === "string";
}

/** Rewrites every cached copy of review `id` with `patch` (a like or
 * comment count changed, its tagged friends were edited), so cards show the
 * change on the way back without refetching their lists. */
export function patchCachedReview(queryClient: QueryClient, id: string, patch: (review: Review) => Review) {
  const visit = (value: unknown, depth: number): unknown => {
    if (!value || typeof value !== "object" || depth > MAX_DEPTH) return value;
    if (Array.isArray(value)) {
      const next = value.map((item) => visit(item, depth + 1));
      return next.some((item, i) => item !== value[i]) ? next : value;
    }
    const obj = value as Record<string, unknown>;
    if (obj.id === id && isReview(obj)) return patch(obj as unknown as Review);
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(obj)) {
      next[key] = visit(child, depth + 1);
      if (next[key] !== child) changed = true;
    }
    return changed ? next : value;
  };
  for (const prefix of REVIEW_LIST_PREFIXES) {
    queryClient.setQueriesData({ queryKey: [prefix] }, (data: unknown) => visit(data, 0));
  }
}

/** A copy of review `id` that some list already loaded, so tapping its card
 * opens the detail at once while the full fetch runs. Profile lists omit
 * `user`, so the reviewer is looked up from any cached user the walk passed;
 * undefined when there's no copy or no reviewer for it. */
export function findCachedReview(queryClient: QueryClient, id: string): ReviewDetail | undefined {
  let found: Review | undefined;
  const users = new Map<string, User>();
  const walk = (value: unknown, depth: number) => {
    if (!value || typeof value !== "object" || depth > MAX_DEPTH) return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    const obj = value as Record<string, unknown>;
    if (typeof obj.id === "string") {
      if (!found && obj.id === id && isReview(obj)) found = obj as unknown as Review;
      if (isUser(obj)) users.set(obj.id, obj as unknown as User);
    }
    for (const child of Object.values(obj)) walk(child, depth + 1);
  };
  for (const prefix of REVIEW_LIST_PREFIXES) {
    for (const [, data] of queryClient.getQueriesData({ queryKey: [prefix] })) walk(data, 0);
  }
  if (!found) return undefined;
  const user = found.user ?? users.get(found.userId);
  return user && { ...found, user };
}

/** Refetches every list a review might be in: after one is deleted, or its
 * verified mark changed. */
export function invalidateReviewLists(queryClient: QueryClient) {
  for (const prefix of REVIEW_LIST_PREFIXES) queryClient.invalidateQueries({ queryKey: [prefix] });
}
