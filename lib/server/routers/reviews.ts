import { TRPCError } from "@trpc/server";
import { and, desc, eq, lt } from "drizzle-orm";
import { z } from "zod";

import { reviews, users } from "../../db/schema";
import { protectedProcedure, publicProcedure, router } from "../trpc";

const crowdVibeSchema = z.enum(["electric", "good", "average", "dead"]);

export const reviewsRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        djId: z.string().uuid(),
        eventId: z.string().uuid().optional(),
        ratingHalfStars: z.number().int().min(1).max(10).optional(),
        reviewText: z.string().max(5000).optional(),
        crowdVibe: crowdVibeSchema.optional(),
        crowdVibeNote: z.string().max(280).optional(),
        seenAt: z.coerce.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(reviews)
        .values({ ...input, userId: ctx.user.id })
        .returning();
      return created;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        ratingHalfStars: z.number().int().min(1).max(10).optional(),
        reviewText: z.string().max(5000).optional(),
        crowdVibe: crowdVibeSchema.optional(),
        crowdVibeNote: z.string().max(280).optional(),
        seenAt: z.coerce.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const [existing] = await ctx.db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
      if (!existing || existing.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [updated] = await ctx.db
        .update(reviews)
        .set({ ...rest, updatedAt: new Date() })
        .where(eq(reviews.id, id))
        .returning();
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(reviews)
        .where(eq(reviews.id, input.id))
        .limit(1);
      if (!existing || existing.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await ctx.db.delete(reviews).where(eq(reviews.id, input.id));
      return { success: true };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const review = await ctx.db.query.reviews.findFirst({
        where: eq(reviews.id, input.id),
        with: { user: true, dj: true, event: true },
      });
      if (!review) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return review;
    }),

  listByUser: publicProcedure
    .input(
      z.object({
        username: z.string(),
        cursor: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.username, input.username))
        .limit(1);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const where = input.cursor
        ? and(eq(reviews.userId, user.id), lt(reviews.seenAt, new Date(input.cursor)))
        : eq(reviews.userId, user.id);

      const items = await ctx.db.query.reviews.findMany({
        where,
        orderBy: desc(reviews.seenAt),
        limit: input.limit,
        with: { dj: true, event: true },
      });

      return {
        items,
        nextCursor:
          items.length === input.limit
            ? items[items.length - 1].seenAt.toISOString()
            : null,
      };
    }),

  listByDj: publicProcedure
    .input(
      z.object({
        djId: z.string().uuid(),
        cursor: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = input.cursor
        ? and(eq(reviews.djId, input.djId), lt(reviews.seenAt, new Date(input.cursor)))
        : eq(reviews.djId, input.djId);

      const items = await ctx.db.query.reviews.findMany({
        where,
        orderBy: desc(reviews.seenAt),
        limit: input.limit,
        with: { user: true, event: true },
      });

      return {
        items,
        nextCursor:
          items.length === input.limit
            ? items[items.length - 1].seenAt.toISOString()
            : null,
      };
    }),
});
