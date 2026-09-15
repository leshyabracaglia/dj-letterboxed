import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";

import { djs, events, follows, reviews, users } from "../../db/schema";
import { protectedProcedure, publicProcedure, router } from "../trpc";

export const usersRouter = router({
  me: protectedProcedure.query(({ ctx }) => ctx.user),

  search: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(users)
        .where(
          or(ilike(users.username, `%${input.query}%`), ilike(users.displayName, `%${input.query}%`)),
        )
        .limit(20);
    }),

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

  getStats: publicProcedure
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

      const [[totals], topDjRows, topVenueRows] = await Promise.all([
        ctx.db
          .select({
            totalLogs: count(),
            uniqueDjs: sql<number>`count(distinct ${reviews.djId})`,
          })
          .from(reviews)
          .where(eq(reviews.userId, user.id)),
        ctx.db
          .select({ dj: djs, logCount: count() })
          .from(reviews)
          .innerJoin(djs, eq(djs.id, reviews.djId))
          .where(eq(reviews.userId, user.id))
          .groupBy(djs.id)
          .orderBy(desc(count()))
          .limit(5),
        ctx.db
          .select({ venue: events.venue, logCount: count() })
          .from(reviews)
          .innerJoin(events, eq(events.id, reviews.eventId))
          .where(eq(reviews.userId, user.id))
          .groupBy(events.venue)
          .orderBy(desc(count()))
          .limit(5),
      ]);

      return {
        totalLogs: Number(totals.totalLogs),
        uniqueDjs: Number(totals.uniqueDjs),
        topDjs: topDjRows.map((r) => ({ dj: r.dj, logCount: Number(r.logCount) })),
        topVenues: topVenueRows.map((r) => ({ venue: r.venue, logCount: Number(r.logCount) })),
      };
    }),

  getLeaderboard: protectedProcedure.query(async ({ ctx }) => {
    const followedRows = await ctx.db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, ctx.user.id));
    const ids = [ctx.user.id, ...followedRows.map((r) => r.followingId)];

    const rows = await ctx.db
      .select({ user: users, logCount: count(reviews.id) })
      .from(users)
      .leftJoin(reviews, eq(reviews.userId, users.id))
      .where(inArray(users.id, ids))
      .groupBy(users.id)
      .orderBy(desc(count(reviews.id)));

    return rows.map((r) => ({ user: r.user, logCount: Number(r.logCount) }));
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
