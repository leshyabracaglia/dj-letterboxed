import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { createContext } from "../../lib/server/trpc";
import { appRouter } from "../../lib/server/routers/_app";

export const config = { runtime: "edge" };

export default function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });
}
