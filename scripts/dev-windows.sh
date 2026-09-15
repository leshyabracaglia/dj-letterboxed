#!/bin/bash
# Brings up the Dockerized backend (Postgres + Go API), applies migrations,
# seeds dev fixture data, then opens dev:app (Expo, native + web) and the
# API logs each in their own Terminal.app window so their output doesn't
# interleave.
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Starting backend (Postgres + Go API) via Docker..."
(cd "$DIR/server" && docker compose up -d --build --wait)

echo "Applying migrations..."
(cd "$DIR/server" && make migrate-up)

echo "Seeding dev fixture data..."
(cd "$DIR/server" && make seed) || echo "Seed skipped (likely already seeded) -- continuing."

osascript <<EOF
tell application "Terminal"
  activate
  do script "cd \"$DIR\" && npm run dev:app"
  do script "cd \"$DIR/server\" && docker compose logs -f"
end tell
EOF
