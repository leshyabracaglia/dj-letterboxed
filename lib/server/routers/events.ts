import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";

import { events, logs } from "../../db/schema";
import { protectedProcedure, publicProcedure, router } from "../trpc";

export const eventsRouter = router({
  search: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(events)
        .where(ilike(events.name, `%${input.query}%`))
        .limit(20);
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [event] = await ctx.db
        .select()
        .from(events)
        .where(eq(events.id, input.id))
        .limit(1);
      if (!event) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const eventLogs = await ctx.db.query.logs.findMany({
        where: eq(logs.eventId, event.id),
        orderBy: desc(logs.seenAt),
        with: { user: true, dj: true },
      });

      return { event, logs: eventLogs };
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(160),
        venue: z.string().min(1).max(160),
        city: z.string().max(120).optional(),
        eventDate: z.coerce.date(),
        description: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(events)
        .where(
          and(
            eq(events.name, input.name),
            eq(events.venue, input.venue),
            eq(events.eventDate, input.eventDate),
          ),
        )
        .limit(1);
      if (existing) {
        return existing;
      }

      const [created] = await ctx.db
        .insert(events)
        .values({ ...input, createdByUserId: ctx.user.id })
        .returning();
      return created;
    }),
});
