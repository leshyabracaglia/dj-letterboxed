# DJ Letterboxed

Letterboxd for DJ sets: log the DJs you've seen live, rate them, write a
review, and follow other users to see their sets in your feed.

## Stack

- **Client**: Expo (React Native + React Native Web), Expo Router, NativeWind
- **API**: tRPC on Vercel Edge Functions (`/api`)
- **Database**: Neon Postgres via Drizzle ORM
- **Auth**: Clerk

## Local development

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` — a Neon connection string (use a dev branch)
   - `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` — from your Clerk app
   - `EXPO_PUBLIC_API_URL` — `http://localhost:3000` for local dev against `vercel dev`
3. Push the schema to your database:
   ```
   npm run db:migrate
   ```
4. (Optional) Seed sample data:
   ```
   npm run db:seed
   ```
5. Run the API and the app together:
   ```
   npm run dev
   ```
   Or separately: `npm run dev:api` (Vercel functions on :3000) and `npm run dev:app` (Expo — press `w` for web, `i` for iOS simulator).

## Other scripts

- `npm run db:generate` — generate a new migration from schema changes
- `npm run db:studio` — browse the database with Drizzle Studio
- `npx tsc --noEmit` — type-check the project

## Project layout

- `app/` — Expo Router screens (file-based routing)
- `api/` — Vercel Edge Functions: the tRPC handler and the Clerk webhook
- `lib/db/` — Drizzle schema, DB client, seed script
- `lib/server/` — tRPC setup and routers
- `components/` — shared UI components
- `hooks/trpc.ts` — client-side tRPC + React Query wiring
- `drizzle/migrations/` — generated SQL migrations

## Deploying

Connect the repo to Vercel — it builds the Expo web export
(`expo export -p web`) and serves the `/api` functions from the same
deployment. Set the environment variables above in the Vercel project, then
run `npm run db:migrate` against the production `DATABASE_URL` before first
deploy. For iOS, build a dev client or production build with EAS Build
pointed at the deployed `EXPO_PUBLIC_API_URL`.
