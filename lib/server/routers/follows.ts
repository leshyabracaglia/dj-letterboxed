import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { follows } from "../../db/schema";
import { protectedProcedure, router } from "../trpc";

export const followsRouter = router({
  isFollowing: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(follows)
        .where(
          and(eq(follows.followerId, ctx.user.id), eq(follows.followingId, input.userId)),
        )
        .limit(1);
      return { following: !!row };
    }),
});
