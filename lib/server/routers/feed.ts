import { and, desc, eq, inArray, lt, notInArray, sql } from "drizzle-orm";
import { z } from "zod";

import type { db as Db } from "../../db/client";
import { follows, reviewComments, reviewLikes, reviews } from "../../db/schema";
import { attachEngagement, type Engagement } from "../reviewEngagement";
import { protectedProcedure, router } from "../trpc";

const POPULAR_INTERLEAVE_EVERY = 4;

async function fetchPopularReviews(
  db: typeof Db,
  {
    limit,
    offset = 0,
    excludeIds = [],
    currentUserId,
  }: { limit: number; offset?: number; excludeIds?: string[]; currentUserId?: string },
) {
  if (limit <= 0) return [];

  const rankedRows = await db
    .select({ id: reviews.id })
    .from(reviews)
    .leftJoin(reviewLikes, eq(reviewLikes.reviewId, reviews.id))
    .leftJoin(reviewComments, eq(reviewComments.reviewId, reviews.id))
    .where(excludeIds.length > 0 ? notInArray(reviews.id, excludeIds) : undefined)
    .groupBy(reviews.id)
    .orderBy(
      desc(sql`count(distinct ${reviewLikes.userId}) + count(distinct ${reviewComments.id})`),
      desc(reviews.createdAt),
    )
    .limit(limit)
    .offset(offset);

  if (rankedRows.length === 0) return [];

  const ids = rankedRows.map((r) => r.id);
  const [fullReviews, engagementById] = await Promise.all([
    db.query.reviews.findMany({
      where: inArray(reviews.id, ids),
      with: { user: true, dj: true, event: true },
    }),
    attachEngagement(db, ids, currentUserId),
  ]);
  const byId = new Map(fullReviews.map((r) => [r.id, r]));

  return ids
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => ({ ...r, ...engagementById[r.id], isPopular: true as const }));
}

function encodeCursor(cursor: { createdAt: string; popularOffset: number }) {
  return JSON.stringify(cursor);
}

function decodeCursor(raw: string | undefined) {
  if (!raw) return { createdAt: undefined as string | undefined, popularOffset: 0 };
  try {
    const parsed = JSON.parse(raw);
    return {
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : undefined,
      popularOffset: Number(parsed.popularOffset) || 0,
    };
  } catch {
    return { createdAt: undefined as string | undefined, popularOffset: 0 };
  }
}

export const feedRouter = router({
  getActivity: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const followedRows = await ctx.db
        .select({ followingId: follows.followingId })
        .from(follows)
        .where(eq(follows.followerId, ctx.user.id));
      const followedIds = followedRows.map((r) => r.followingId);

      if (followedIds.length === 0) {
        return { items: [], nextCursor: null, followingCount: 0 };
      }

      const { createdAt: cursorCreatedAt, popularOffset } = decodeCursor(input.cursor);

      const where = cursorCreatedAt
        ? and(inArray(reviews.userId, followedIds), lt(reviews.createdAt, new Date(cursorCreatedAt)))
        : inArray(reviews.userId, followedIds);

      const followedItems = await ctx.db.query.reviews.findMany({
        where,
        orderBy: desc(reviews.createdAt),
        limit: input.limit,
        with: { user: true, dj: true, event: true },
      });

      const [popularItems, followedEngagement] = await Promise.all([
        fetchPopularReviews(ctx.db, {
          limit: Math.floor(followedItems.length / POPULAR_INTERLEAVE_EVERY),
          offset: popularOffset,
          excludeIds: followedItems.map((i) => i.id),
          currentUserId: ctx.user.id,
        }),
        attachEngagement(
          ctx.db,
          followedItems.map((i) => i.id),
          ctx.user.id,
        ),
      ]);

      const items: Array<(typeof followedItems)[number] & Engagement & { isPopular?: boolean }> =
        [];
      let popularIdx = 0;
      followedItems.forEach((item, idx) => {
        items.push({ ...item, ...followedEngagement[item.id], isPopular: false });
        if ((idx + 1) % POPULAR_INTERLEAVE_EVERY === 0 && popularIdx < popularItems.length) {
          items.push(popularItems[popularIdx]);
          popularIdx++;
        }
      });

      const nextCursor =
        followedItems.length === input.limit
          ? encodeCursor({
              createdAt: followedItems[followedItems.length - 1].createdAt.toISOString(),
              popularOffset: popularOffset + popularItems.length,
            })
          : null;

      return { items, nextCursor, followingCount: followedIds.length };
    }),

  getPopular: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const items = await fetchPopularReviews(ctx.db, {
        limit: input.limit,
        currentUserId: ctx.user.id,
      });
      return { items };
    }),
});
