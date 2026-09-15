import { TRPCError } from "@trpc/server";
import { avg, count, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";

import { djs, reviews } from "../../db/schema";
import { searchArtists } from "../spotify";
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
          .select({ avgRating: avg(reviews.ratingHalfStars), logCount: count() })
          .from(reviews)
          .where(eq(reviews.djId, dj.id)),
        ctx.db.query.reviews.findMany({
          where: eq(reviews.djId, dj.id),
          orderBy: desc(reviews.seenAt),
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
        spotifyId: z.string().optional(),
        imageUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.spotifyId) {
        const [existingBySpotifyId] = await ctx.db
          .select()
          .from(djs)
          .where(eq(djs.spotifyId, input.spotifyId))
          .limit(1);
        if (existingBySpotifyId) {
          return existingBySpotifyId;
        }
      }

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
          spotifyId: input.spotifyId,
          imageUrl: input.imageUrl,
          createdByUserId: ctx.user.id,
        })
        .returning();
      return created;
    }),

  searchSpotify: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        return await searchArtists(input.query);
      } catch (err) {
        console.error("[djs.searchSpotify] Spotify search failed:", err);
        return [];
      }
    }),
});
