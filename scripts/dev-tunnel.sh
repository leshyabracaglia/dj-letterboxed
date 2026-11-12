#!/bin/bash
# Runs the app for a phone that isn't on the Mac's Wi-Fi: a Cloudflare quick
# tunnel exposes the local API (:8080) and Expo's ngrok tunnel serves the
# bundle. Over an Expo tunnel the client uses EXPO_PUBLIC_API_URL (see
# lib/api/client.ts), so it's pointed at the Cloudflare URL here. The API must
# already be up (npm run dev:api). The Cloudflare URL changes every run, so
# reload the app on the phone after restarting this.
set -euo pipefail

if ! command -v cloudflared >/dev/null; then
  echo "cloudflared isn't installed: brew install cloudflared" >&2
  exit 1
fi

if ! curl -fsS -o /dev/null http://localhost:8080/healthz; then
  echo "The API isn't answering on :8080. Start it with npm run dev:api first." >&2
  exit 1
fi

LOG="$(mktemp -t beatboxd-cloudflared)"
cloudflared tunnel --no-autoupdate --url http://localhost:8080 >"$LOG" 2>&1 &
CF_PID=$!
trap 'kill $CF_PID 2>/dev/null; rm -f "$LOG"' EXIT

echo "Opening a Cloudflare tunnel to the API..."
API_URL=""
for _ in $(seq 1 30); do
  API_URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)"
  [ -n "$API_URL" ] && break
  if ! kill -0 $CF_PID 2>/dev/null; then
    cat "$LOG" >&2
    exit 1
  fi
  sleep 1
done
if [ -z "$API_URL" ]; then
  echo "cloudflared didn't print a tunnel URL in 30s:" >&2
  cat "$LOG" >&2
  exit 1
fi

# A new quick tunnel's DNS can take a minute to resolve (and the Mac may cache
# the miss for a bit longer); the phone resolves it fresh, so don't block on it.
echo "API tunnel: $API_URL (can take a minute to start answering)"
# --clear so the new EXPO_PUBLIC_API_URL is inlined rather than a cached one.
EXPO_PUBLIC_API_URL="$API_URL" npx expo start --tunnel --clear
