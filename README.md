# BeatBox'd

Letterboxd for DJ sets, and a community-built database of the
electronic music scene.

Each night you log adds to a shared record of who played where and how it
went. Every DJ, venue and event gets its own page, and the reviews, ratings and
stats pile up there over time.

**[beatboxd.com](https://www.beatboxd.com)** · iOS via TestFlight

## Features

### Your diary

- **Log a night**: pick the event, venue and date, choose whether it was a
  day or night party (or both), add everyone on the lineup, then rate the night
  and/or each DJ (1–5 stars) with a written review.
- **Tags and friends**: describe the crowd and the room with tags ("packed",
  "great sound", "groovy", or your own), and tag the friends you went with.
- **Profile**: your stats (top DJs, top venues, totals), favorite reviews,
  and shareable story images.

### The database

- **DJs**: average rating, review count, genres, and every review of them.
  New DJs can be pulled from Spotify.
- **Venues**: linked to Google Places, with the events they've hosted.
- **Events**: each night has its lineup and its reviews. Recurring series
  ("Innervisions") group their nights across venues and cities, showing who's
  played, where, and how each night rated.
- Everything is built from what users log. There's no editorial layer, so the
  data grows with the community.

### Social

- Follow people and get a feed of their logs.
- Like and comment on reviews.
- Leaderboard among the people you follow.
- Push notifications for new followers, likes and comments.

## Stack

| | |
|---|---|
| **App** | Expo (React Native + React Native Web), Expo Router, NativeWind, TanStack Query |
| **API** | Go REST service (`server/`), hand-written SQL via `pgx`, OpenAPI docs at `/docs` |
| **Database** | Postgres (RDS in production, Docker locally), migrations via `golang-migrate` |
| **Auth** | Clerk (JWTs verified by the API, users synced by webhook) |
| **Push** | `expo-notifications` + Expo's push service |
| **Hosting** | Web export on Vercel; API on a single AWS EC2 instance (Terraform in `infra/terraform/`); iOS/Android via EAS |

## Local development

Prerequisites: Node, Go, and Docker.

1. Install dependencies:
   ```
   npm install
   ```
2. Configure environment:
   ```
   cp .env.example .env                # EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
   cp server/.env.example server/.env  # Clerk, Spotify; Google Places and Expo are optional
   ```
   In development the app automatically talks to the API on port 8080 of the
   machine serving the bundle, so `EXPO_PUBLIC_API_URL` is only needed for
   production builds.
3. Start the backend (Postgres + Go API on `:8080`), then set up the database:
   ```
   npm run dev:api
   npm run db:migrate
   npm run db:seed      # optional: two users, a few DJs, an event, reviews
   ```
4. Start the app:
   ```
   npm run dev:app      # press w for web, i for the iOS simulator
   ```

On macOS, `npm run dev` does steps 3–4 in one go. It starts the backend,
migrates, seeds, and opens the app and the API logs in separate Terminal
windows.

Push notifications need a development or production build on a real device.
They don't work in Expo Go on Android or in simulators.

## Scripts

| Command | What it does |
|---|---|
| `npm run db:migrate` / `db:seed` / `db:reset` | Apply migrations, seed fixtures, or drop and rebuild the local DB |
| `npm run codegen:api-types` | Regenerate the OpenAPI spec from the Go handlers and the client's TS types from it |
| `npx tsc --noEmit` | Type-check the app |
| `cd server && go build ./... && go vet ./... && go test ./...` | Build, vet and test the API |

CI fails a PR if the OpenAPI spec or the generated types are out of date, so
run `npm run codegen:api-types` and commit the result after changing a
handler.

## Project layout

```
app/                  Expo Router screens (file-based routing)
components/           Domain components (ReviewCard, StatsSummary, ...)
components/ui/        Generic UI primitives (Text, Button, Page, ...)
lib/                  API client and hooks, auth, routes, push notifications
server/
  cmd/                api, migrate, seed entrypoints
  internal/httpapi/   HTTP handlers, one file per domain
  internal/domain/    Business logic and external clients (Spotify, Places, Expo push)
  internal/db/        Models and hand-written SQL queries
  migrations/         Numbered .up.sql / .down.sql pairs
  docs/               Generated OpenAPI spec
infra/terraform/      AWS infrastructure (EC2 + RDS)
```

## Deploying

- **Web**: Vercel builds `expo export -p web` into `dist/` (static only).
- **API**: see [`infra/terraform/README.md`](infra/terraform/README.md) for
  the AWS setup and deploy workflow. Run new migrations against production
  before or alongside the deploy that needs them.
- **iOS/Android**: EAS Build, pointed at `EXPO_PUBLIC_API_URL`
  (`https://api.beatboxd.com`). Push notifications need APNs/FCM credentials
  configured in EAS.
