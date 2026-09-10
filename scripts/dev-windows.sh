#!/bin/bash
# Opens dev:app (Expo, serving native + web) and dev:api (local backend)
# each in their own Terminal.app window, so their logs don't interleave.
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

osascript <<EOF
tell application "Terminal"
  activate
  do script "cd \"$DIR\" && npm run dev:app"
  do script "cd \"$DIR\" && npm run dev:api"
end tell
EOF
