import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { z } from "zod";

import { follows, logs } from "../../db/schema";
import { protectedProcedure, router } from "../trpc";

export const feedRouter = router({
  getActivity: protectedProcedure
    .input(
      z.object({
        cursor: z.string().datetime().optional(),
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
        return { items: [], nextCursor: null };
      }

      const where = input.cursor
        ? and(inArray(logs.userId, followedIds), lt(logs.createdAt, new Date(input.cursor)))
        : inArray(logs.userId, followedIds);

      const items = await ctx.db.query.logs.findMany({
        where,
        orderBy: desc(logs.createdAt),
        limit: input.limit,
        with: { user: true, dj: true, event: true },
      });

      return {
        items,
        nextCursor:
          items.length === input.limit
            ? items[items.length - 1].createdAt.toISOString()
            : null,
      };
    }),
});
