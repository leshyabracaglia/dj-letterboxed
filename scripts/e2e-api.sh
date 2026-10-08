#!/usr/bin/env bash
# Started by Playwright (playwright.config.ts) as the e2e suite's API server.
# Recreates a dedicated beatboxd_e2e database in the docker-compose Postgres
# (never the dev `beatboxd` DB, so your local data is left alone), migrates
# and seeds it, then runs the Go API against it on E2E_API_PORT.
set -euo pipefail

E2E_API_PORT="${E2E_API_PORT:-8090}"
COMPOSE=(docker compose -f server/docker-compose.yml)

"${COMPOSE[@]}" up -d --wait postgres
"${COMPOSE[@]}" exec -T postgres psql -q -U beatboxd -d postgres \
  -c "DROP DATABASE IF EXISTS beatboxd_e2e WITH (FORCE)" \
  -c "CREATE DATABASE beatboxd_e2e"

E2E_DATABASE_URL="postgres://beatboxd:beatboxd@localhost:5433/beatboxd_e2e?sslmode=disable"
DATABASE_URL="$E2E_DATABASE_URL" go -C server run ./cmd/migrate up
DATABASE_URL="$E2E_DATABASE_URL" go -C server run ./cmd/seed

# Clerk config is required at startup even though the pages under test are
# public. Spotify/Places/Expo keys stay unset; nothing under test calls them.
if [[ -f server/.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source server/.env
  set +a
fi
export DATABASE_URL="$E2E_DATABASE_URL" PORT="$E2E_API_PORT"
unset SPOTIFY_CLIENT_ID SPOTIFY_CLIENT_SECRET GOOGLE_PLACES_API_KEY EXPO_ACCESS_TOKEN
exec go -C server run ./cmd/api
