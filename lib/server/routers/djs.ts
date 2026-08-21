import { TRPCError } from "@trpc/server";
import { avg, count, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";

import { djs, logs } from "../../db/schema";
import { protectedProcedure, publicProcedure, router } from "../trpc";

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const djsRouter = router({
  search: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(djs)
        .where(ilike(djs.name, `%${input.query}%`))
        .limit(20);
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const [dj] = await ctx.db.select().from(djs).where(eq(djs.slug, input.slug)).limit(1);
      if (!dj) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [[stats], recentLogs] = await Promise.all([
        ctx.db
          .select({ avgRating: avg(logs.ratingHalfStars), logCount: count() })
          .from(logs)
          .where(eq(logs.djId, dj.id)),
        ctx.db.query.logs.findMany({
          where: eq(logs.djId, dj.id),
          orderBy: desc(logs.seenAt),
          limit: 25,
          with: { user: true, event: true },
        }),
      ]);

      return { dj, avgRating: stats.avgRating, logCount: stats.logCount, recentLogs };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(128),
        bio: z.string().max(1000).optional(),
        genres: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const slug = slugify(input.name);

      const [existing] = await ctx.db.select().from(djs).where(eq(djs.slug, slug)).limit(1);
      if (existing) {
        return existing;
      }

      const [created] = await ctx.db
        .insert(djs)
        .values({
          name: input.name,
          slug,
          bio: input.bio,
          genres: input.genres,
          createdByUserId: ctx.user.id,
        })
        .returning();
      return created;
    }),
});
