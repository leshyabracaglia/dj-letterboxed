import { eq } from "drizzle-orm";
import { Webhook } from "svix";

import { db } from "../../lib/db/client";
import { users } from "../../lib/db/schema";

export const config = { runtime: "edge" };

type ClerkUserEvent = {
  type: "user.created" | "user.updated" | "user.deleted";
  data: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  };
};

export default async function handler(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let event: ClerkUserEvent;
  try {
    event = new Webhook(secret).verify(payload, headers) as ClerkUserEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const { id: clerkId } = event.data;

  if (event.type === "user.deleted") {
    await db.delete(users).where(eq(users.clerkId, clerkId));
    return new Response("ok");
  }

  const username =
    event.data.username ?? `user_${clerkId.slice(-8)}`;
  const displayName =
    [event.data.first_name, event.data.last_name].filter(Boolean).join(" ") || null;

  await db
    .insert(users)
    .values({
      clerkId,
      username,
      displayName,
      avatarUrl: event.data.image_url ?? undefined,
    })
    .onConflictDoUpdate({
      target: users.clerkId,
      set: {
        displayName,
        avatarUrl: event.data.image_url ?? undefined,
        updatedAt: new Date(),
      },
    });

  return new Response("ok");
}
