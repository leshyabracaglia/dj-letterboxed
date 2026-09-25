# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Working directory

The shell already starts at the repo root. Never `cd` in shell commands — not into subfolders, the scratchpad, `/tmp`, or `node_modules`, and not back to the repo root either. Run everything with repo-relative paths (`npx tsc --noEmit`, `grep -r foo components/`).

## What this is

Letterboxd for DJ sets: log DJs you've seen live, rate them, write a review, and follow other users to see their sets in a feed.

Stack: Expo (React Native + React Native Web) with Expo Router, NativeWind for styling; a Go HTTP API deployed on AWS (ECS Fargate previously, currently a single EC2 instance running Docker Compose for cost reasons — see `infra/terraform/README.md`); AWS RDS Postgres; Clerk for auth. The web export still deploys via Vercel (static hosting only — the API used to live there too as tRPC Edge Functions, but moved off after an unfixable Vercel Edge Function bundler bug; see git history around the "move to aws and go backend" commit for the full story).

## Commands

Setup:
```
npm install
cp .env.example .env   # fill in EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, EXPO_PUBLIC_API_URL
cd server && cp .env.example .env   # fill in DATABASE_URL, CLERK_*, SPOTIFY_* — see server/.env.example
```

Running locally — the app talks to the API over HTTP, so both need to be up:
```
npm run dev             # runs dev:api and dev:app together via concurrently
npm run dev:api         # docker compose up for server/ (Postgres + Go API), API on :8080
npm run dev:app         # expo start — press w for web, i for iOS simulator
```

First-time local DB setup (against the docker-compose Postgres, entirely separate from the production RDS instance):
```
npm run db:migrate   # applies server/migrations/*.sql via golang-migrate
npm run db:seed      # ported fixture data (2 users, 3 djs, 1 event, reviews/likes/comments)
```

Type checking: `npx tsc --noEmit` (client). Server: `cd server && go build ./... && go vet ./... && go test ./...` (there is no lint script or test runner configured for the client).

## Architecture

**Routing**: `app/` is Expo Router file-based routing. `(auth)` and `(tabs)` are route groups; `app/_layout.tsx` is the root layout and wraps everything in `ClerkProvider` → `QueryClientProvider`. All in-app links and navigation must go through the `ROUTES` constant in `lib/routes.ts` — never hardcode a path string in `Link href`, `router.push`/`replace`, or `Redirect href`. Static routes are plain `Href` values (`ROUTES.FEED`, `ROUTES.SIGN_IN`); dynamic routes are functions that build the `Href` from an id/slug (`ROUTES.DJ(slug)`, `ROUTES.USER(username)`). When a new route is added under `app/`, add a corresponding entry to `ROUTES` in the same change.

**Components & page layout**: generic, domain-agnostic UI primitives (`Text`, `Card`, `GlassSurface`, `Button`, `Avatar`, `RatingStars`, `EmptyState`, `Page`, `PageHeader`, …) live in `components/ui/` and are imported from its barrel (`components/ui`). Components that know about reviews/DJs/users (`ReviewCard`, `StatsSummary`, `FavoritesShowcase`, …) stay in `components/` — but only once they're used from two or more files. A component used by a single file lives in that file as an unexported function (Expo Router turns every file under `app/` into a route, so a screen's helper components can't sit beside it as separate files); promote it to `components/` when a second consumer appears. When pulling in a [React Native Reusables](https://reactnativereusables.com) component, adapt it straight into a single `components/ui/` file built on its `@rn-primitives/*` package with the app's API and theme (as `ui/Avatar` does) — don't keep a separate raw copy plus a wrapper. If a component needs RNR's `cn` helper, use `tailwind-merge` v2 (v3 requires Tailwind 4). Every screen renders inside `<Page>` (safe area + themed background, optional `ambient` glow, optional `title`/`header`), and lists/scroll views take `usePageContentStyle()` as their `contentContainerStyle` so content lines up with the shared horizontal gutter (`components/ui/layout.ts`) — don't hand-roll `SafeAreaView` or `padding: 16` on a screen. Custom top-of-screen blocks (profile/detail headers) go in `<PageHeader>` (with `border="primary" | "accent"` for the divider) to stay on the same gutter.

**API**: the Go service in `server/` (see `server/README` references in `infra/terraform/README.md` for deploy details). Handlers live in `server/internal/httpapi/`, one file per domain (`djs`, `events`, `follows`, `reviews`, `users`, `feed`, plus `webhooks` for the Clerk sync endpoint), wired up in `server/internal/httpapi/router.go`. Business logic that doesn't belong in a handler (feed ranking/interleave, review-tag replace semantics, Spotify client, slugify) lives in `server/internal/domain/`; DB access is hand-written SQL in `server/internal/db/queries/` against `pgx`/`pgxpool` (no ORM). This is a plain REST API (no tRPC), but it's not undocumented either: every handler carries `swag`-style `@Summary`/`@Param`/`@Success`/`@Router` doc comments, and `server/docs/{swagger.json,swagger.yaml}` (generated, not hand-written — run `make openapi` in `server/` after touching a handler's signature or docs) is served live at `/docs/*`. Response types on the client are generated from that spec too — see "Client data fetching" below — so a handler's real output shape and the client's compile-time types can't silently drift the way they could with plain hand-written types.

**Auth flow** (`server/internal/httpapi/middleware.go` + `server/internal/auth/clerk.go`): the client attaches a Clerk-issued bearer JWT on every request (`lib/api/client.ts`'s `useApi()`, via `getToken()` from `@clerk/expo`). The Go service verifies that JWT itself against Clerk's public JWKS (no Clerk SDK needed for this). `RequireAuth` then resolves the verified Clerk ID to a row in the local `users` table — and **lazily creates one with a fallback username if it doesn't exist yet**, in case the Clerk webhook hasn't landed. The webhook handler (`server/internal/httpapi/webhooks_handlers.go`, svix-verified) is the primary sync path for `user.created`/`user.updated`/`user.deleted`; the lazy-create in `RequireAuth` is just a race-condition fallback, not the main path — don't remove one without considering the other.

**Data model** (`server/migrations/*.sql`, plain Postgres DDL applied via `golang-migrate`): `users`, `djs`, `events`, `reviews`, `review_likes`, `review_comments`, `review_tags`, `follows`. `reviews` is the core entity — one user's log of one DJ (optionally tied to an `event`) — with `rating` stored as whole stars, an integer 1–5 (no half stars). `follows` has no surrogate key, just a composite PK on `(follower_id, following_id)`. Schema changes: hand-write a new numbered `.up.sql`/`.down.sql` pair in `server/migrations/` (Drizzle/drizzle-kit generation was retired along with the old Node API — there's no schema-diffing tool in this repo anymore).

**Client data fetching**: `lib/api/client.ts`'s `useApi()` hook returns a small `{get, post, patch, del}` client bound to the current Clerk token, pointed at `EXPO_PUBLIC_API_URL` in production builds; in `__DEV__` it instead auto-targets `:8080` on the host serving the Metro bundle (page hostname on web, `Constants.expoConfig.hostUri` on native), so LAN IP changes need no `.env` edit. Each screen calls it directly with `@tanstack/react-query`'s `useQuery`/`useMutation`/`useInfiniteQuery`, using the key factories in `lib/api/queryKeys.ts` (no tRPC — keys are hand-assigned, not auto-derived). Response types in `lib/api/types.ts` are aliased from `lib/api/generated.ts`, which is **generated, not hand-written** — `npm run codegen:api-types` regenerates `server/docs/swagger.json` from the Go handlers' doc comments (via `swag`) and then `lib/api/generated.ts` from that spec (via `swagger2openapi` + `openapi-typescript`; see `scripts/generate-api-types.sh`). Request body types in `lib/api/types.ts` stay hand-written (lower drift risk, and OpenAPI's json-schema shapes don't cleanly express TS's optional-vs-omitted distinction that `taggedUserIds` relies on). `.github/workflows/server-ci.yml` regenerates both the spec and the TS types on every PR touching `server/**` or `lib/api/**` and fails the build if either drifted from what's committed — so run `npm run codegen:api-types` and commit the result whenever a handler's shape changes. One known imprecision: Go doesn't distinguish "field always present, sometimes null" from "field always present, never null" in a way `swag` picks up, so nullable fields (e.g. `Dj.bio`) type as non-null in the generated types even though they can be `null` at runtime — every current call site already guards these with truthy checks regardless, but don't chain off one of these fields without a null check just because TS doesn't complain. Dates arrive as RFC3339 strings, not `Date` objects (screens already wrap them in `new Date(...)` where displayed).

**Deployment**: Vercel builds the Expo web export (`expo export -p web`, see `vercel.json`) into `dist/` — no `/api/*` on Vercel anymore, just the static export. The Go API + Postgres run on AWS, provisioned via Terraform in `infra/terraform/` — see `infra/terraform/README.md` for the current architecture (cost-minimized: one EC2 instance + RDS, no ALB/ECS/Aurora) and the two-phase apply workflow. iOS/Android are separate EAS builds pointed at the deployed `EXPO_PUBLIC_API_URL` (`https://api.beatboxd.com`).
