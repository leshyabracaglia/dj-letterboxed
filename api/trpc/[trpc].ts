import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { createContext } from "../../lib/server/trpc";
import { appRouter } from "../../lib/server/routers/_app";

export const config = { runtime: "edge" };

// The Expo web client is served from a different origin than this API in
// local dev (Metro vs. `vercel dev`), so browser requests need CORS headers.
// Auth is Bearer-token based, not cookies, so reflecting the origin here
// carries no session-fixation risk.
function corsHeaders(origin: string | null) {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", origin ?? "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "authorization, content-type");
  headers.set("Vary", "Origin");
  return headers;
}

export default async function handler(req: Request) {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });

  const headers = new Headers(response.headers);
  corsHeaders(origin).forEach((value, key) => headers.set(key, value));

  return new Response(response.body, { status: response.status, headers });
}
