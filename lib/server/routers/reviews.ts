import { TRPCError } from "@trpc/server";
import { and, desc, eq, lt } from "drizzle-orm";
import { z } from "zod";

import { reviewComments, reviewLikes, reviewTags, reviews, users } from "../../db/schema";
import { attachEngagement } from "../reviewEngagement";
import { protectedProcedure, publicProcedure, resolveOptionalUserId, router } from "../trpc";

const crowdVibeSchema = z.enum(["electric", "good", "average", "dead"]);

async function setReviewTags(
  db: Parameters<typeof attachEngagement>[0],
  reviewId: string,
  taggedUserIds: string[] | undefined,
) {
  if (taggedUserIds === undefined) return;
  await db.delete(reviewTags).where(eq(reviewTags.reviewId, reviewId));
  const uniqueIds = [...new Set(taggedUserIds)];
  if (uniqueIds.length > 0) {
    await db
      .insert(reviewTags)
      .values(uniqueIds.map((taggedUserId) => ({ reviewId, taggedUserId })));
  }
}

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
        taggedUserIds: z.array(z.string().uuid()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { taggedUserIds, ...rest } = input;
      const [created] = await ctx.db
        .insert(reviews)
        .values({ ...rest, userId: ctx.user.id })
        .returning();
      await setReviewTags(ctx.db, created.id, taggedUserIds);
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
        taggedUserIds: z.array(z.string().uuid()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, taggedUserIds, ...rest } = input;
      const [existing] = await ctx.db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
      if (!existing || existing.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [updated] = await ctx.db
        .update(reviews)
        .set({ ...rest, updatedAt: new Date() })
        .where(eq(reviews.id, id))
        .returning();
      await setReviewTags(ctx.db, id, taggedUserIds);
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
        with: {
          user: true,
          dj: true,
          event: true,
          tags: { with: { taggedUser: true } },
        },
      });
      if (!review) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const currentUserId = await resolveOptionalUserId(ctx);
      const engagement = await attachEngagement(ctx.db, [review.id], currentUserId);
      const { tags, ...rest } = review;

      return {
        ...rest,
        ...engagement[review.id],
        taggedUsers: tags.map((t) => t.taggedUser),
      };
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

      const currentUserId = await resolveOptionalUserId(ctx);
      const engagement = await attachEngagement(
        ctx.db,
        items.map((i) => i.id),
        currentUserId,
      );

      return {
        items: items.map((item) => ({ ...item, ...engagement[item.id] })),
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

      const currentUserId = await resolveOptionalUserId(ctx);
      const engagement = await attachEngagement(
        ctx.db,
        items.map((i) => i.id),
        currentUserId,
      );

      return {
        items: items.map((item) => ({ ...item, ...engagement[item.id] })),
        nextCursor:
          items.length === input.limit
            ? items[items.length - 1].seenAt.toISOString()
            : null,
      };
    }),

  like: protectedProcedure
    .input(z.object({ reviewId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(reviewLikes)
        .values({ reviewId: input.reviewId, userId: ctx.user.id })
        .onConflictDoNothing();
      return { success: true };
    }),

  unlike: protectedProcedure
    .input(z.object({ reviewId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(reviewLikes)
        .where(
          and(eq(reviewLikes.reviewId, input.reviewId), eq(reviewLikes.userId, ctx.user.id)),
        );
      return { success: true };
    }),

  listComments: publicProcedure
    .input(z.object({ reviewId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.reviewComments.findMany({
        where: eq(reviewComments.reviewId, input.reviewId),
        orderBy: (c, { asc }) => asc(c.createdAt),
        with: { user: true },
      });
    }),

  addComment: protectedProcedure
    .input(z.object({ reviewId: z.string().uuid(), body: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(reviewComments)
        .values({ reviewId: input.reviewId, userId: ctx.user.id, body: input.body })
        .returning();
      return { ...created, user: ctx.user };
    }),

  deleteComment: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(reviewComments)
        .where(eq(reviewComments.id, input.id))
        .limit(1);
      if (!existing || existing.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await ctx.db.delete(reviewComments).where(eq(reviewComments.id, input.id));
      return { success: true };
    }),
});
