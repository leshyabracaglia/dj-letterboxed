import { TRPCError } from "@trpc/server";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";

import { follows, reviews, users } from "../../db/schema";
import { protectedProcedure, publicProcedure, router } from "../trpc";

export const usersRouter = router({
  me: protectedProcedure.query(({ ctx }) => ctx.user),

  getByUsername: publicProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [[logCount], [followerCount], [followingCount]] = await Promise.all([
        ctx.db.select({ value: count() }).from(reviews).where(eq(reviews.userId, user.id)),
        ctx.db
          .select({ value: count() })
          .from(follows)
          .where(eq(follows.followingId, user.id)),
        ctx.db
          .select({ value: count() })
          .from(follows)
          .where(eq(follows.followerId, user.id)),
      ]);

      return {
        user,
        logCount: logCount.value,
        followerCount: followerCount.value,
        followingCount: followingCount.value,
      };
    }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        displayName: z.string().max(64).optional(),
        bio: z.string().max(500).optional(),
        avatarUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(users)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(users.id, ctx.user.id))
        .returning();
      return updated;
    }),

  follow: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot follow yourself" });
      }
      await ctx.db
        .insert(follows)
        .values({ followerId: ctx.user.id, followingId: input.userId })
        .onConflictDoNothing();
      return { success: true };
    }),

  unfollow: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(follows)
        .where(
          and(eq(follows.followerId, ctx.user.id), eq(follows.followingId, input.userId)),
        );
      return { success: true };
    }),

  getFollowers: publicProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.follows.findMany({
        where: eq(follows.followingId, input.userId),
        with: { follower: true },
      });
    }),

  getFollowing: publicProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.follows.findMany({
        where: eq(follows.followerId, input.userId),
        with: { following: true },
      });
    }),
});
