import { verifyToken } from "@clerk/backend";
import { TRPCError, initTRPC } from "@trpc/server";
import { eq } from "drizzle-orm";
import superjson from "superjson";

import { db } from "../db/client";
import { users } from "../db/schema";

export async function createContext({ req }: { req: Request }) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return { db, clerkUserId: null as string | null };
  }

  try {
    const verified = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    return { db, clerkUserId: verified.sub };
  } catch (err) {
    console.error("[createContext] token verification failed:", err);
    return { db, clerkUserId: null as string | null };
  }
}

type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

// Resolves the verified Clerk identity to our own `users` row, creating it
// on first sight in case the `user.created` webhook hasn't landed yet.
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.clerkUserId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  let [user] = await ctx.db
    .select()
    .from(users)
    .where(eq(users.clerkId, ctx.clerkUserId))
    .limit(1);

  if (!user) {
    const fallbackUsername = `user_${ctx.clerkUserId.slice(-8)}`;
    [user] = await ctx.db
      .insert(users)
      .values({ clerkId: ctx.clerkUserId, username: fallbackUsername })
      .onConflictDoNothing({ target: users.clerkId })
      .returning();

    if (!user) {
      [user] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.clerkId, ctx.clerkUserId))
        .limit(1);
    }
  }

  if (!user) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not resolve user" });
  }

  return next({ ctx: { ...ctx, user } });
});

// For publicProcedure handlers that want to personalize a response (e.g. "did I like this?")
// when the caller happens to be signed in, without requiring auth like protectedProcedure does.
export async function resolveOptionalUserId(ctx: Context): Promise<string | undefined> {
  if (!ctx.clerkUserId) return undefined;
  const [user] = await ctx.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, ctx.clerkUserId))
    .limit(1);
  return user?.id;
}
