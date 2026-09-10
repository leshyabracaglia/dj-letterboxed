# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

Letterboxd for DJ sets: log DJs you've seen live, rate them, write a review, and follow other users to see their sets in a feed.

Stack: Expo (React Native + React Native Web) with Expo Router, NativeWind for styling; tRPC API running as Vercel Edge Functions; Neon Postgres via Drizzle ORM; Clerk for auth.

## Commands

Setup:
```
npm install
cp .env.example .env   # fill in DATABASE_URL, CLERK_SECRET_KEY, CLERK_WEBHOOK_SIGNING_SECRET, EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, EXPO_PUBLIC_API_URL
npm run db:migrate     # push schema to the database
npm run db:seed        # optional sample data
```

Running locally — the app talks to the API over HTTP, so both need to be up:
```
npm run dev             # runs dev:api and dev:app together via concurrently
npm run dev:api         # vercel dev, API on :3000
npm run dev:app         # expo start — press w for web, i for iOS simulator
```

Database (Drizzle):
```
npm run db:generate   # generate a migration from schema.ts changes
npm run db:migrate    # apply migrations
npm run db:studio     # browse the DB with Drizzle Studio
```

Type checking: `npx tsc --noEmit` (there is no lint script or test runner configured in this repo).

## Architecture

**Routing**: `app/` is Expo Router file-based routing. `(auth)` and `(tabs)` are route groups; `app/_layout.tsx` is the root layout and wraps everything in `ClerkProvider` → `QueryClientProvider` → `TRPCProvider`. All in-app links and navigation must go through the `ROUTES` constant in `lib/routes.ts` — never hardcode a path string in `Link href`, `router.push`/`replace`, or `Redirect href`. Static routes are plain `Href` values (`ROUTES.FEED`, `ROUTES.SIGN_IN`); dynamic routes are functions that build the `Href` from an id/slug (`ROUTES.DJ(slug)`, `ROUTES.USER(username)`). When a new route is added under `app/`, add a corresponding entry to `ROUTES` in the same change.

**API**: tRPC routers live in `lib/server/routers/` (one file per domain: `djs`, `events`, `feed`, `follows`, `logs`, `users`) and are combined into `appRouter` in `lib/server/routers/_app.ts`. The single Vercel Edge Function handler at `api/trpc/[trpc].ts` serves all of them via `fetchRequestHandler`; there's no separate route per procedure.

**Auth flow** (`lib/server/trpc.ts`): the client attaches a Clerk-issued bearer JWT on every request (`hooks/trpc.ts`, via `getToken()` from `@clerk/expo`). `createContext` verifies that JWT server-side with `@clerk/backend`. `protectedProcedure` then resolves the verified Clerk ID to a row in the local `users` table — and **lazily creates one with a fallback username if it doesn't exist yet**, in case the Clerk webhook hasn't landed. The webhook at `api/webhooks/clerk.ts` (svix-verified, edge runtime) is the primary sync path for `user.created`/`user.updated`/`user.deleted`; the lazy-create in `protectedProcedure` is just a race-condition fallback, not the main path — don't remove one without considering the other.

**Data model** (`lib/db/schema.ts`, Drizzle + Neon serverless client in `lib/db/client.ts`): `users`, `djs`, `events`, `logs`, `follows`. `logs` is the core review entity — one user's log of one DJ (optionally tied to an `event`) — with `ratingHalfStars` stored as an integer 1–10 (half-star increments; UI divides by 2 for a 0.5–5.0 star display). `follows` has no surrogate key, just a composite PK on `(followerId, followingId)`. Migrations are generated into `drizzle/migrations/` and must be applied with `db:migrate`; schema changes always go through `db:generate` rather than hand-written SQL.

**Client data fetching**: `hooks/trpc.ts` wires `@trpc/tanstack-react-query`. `useCreateTRPCClient` builds the tRPC client per-render-tree (memoized on `getToken`) so the auth header is always current; it points at `EXPO_PUBLIC_API_URL` (falls back to `http://localhost:3000`), not a relative path — this matters because the Expo client and the API are logically separate origins even though production serves both from one Vercel project.

**Deployment**: one Vercel project. `vercel.json` builds the Expo web export (`expo export -p web`) into `dist/` and rewrites all non-`/api` paths to `index.html`; `/api/*` is served by the Edge Functions in `api/`. Both `api/trpc/[trpc].ts` and `api/webhooks/clerk.ts` declare `export const config = { runtime: "edge" }`. iOS/Android are separate EAS builds pointed at the deployed `EXPO_PUBLIC_API_URL`.
