#!/bin/bash
# Regenerates lib/api/generated.ts from server/docs/swagger.json (itself
# generated from the @-annotations above each Go handler via swag - run
# `make openapi` in server/ first, or use `npm run codegen:api-types`
# which does both steps).
#
# swag emits Swagger 2.0; openapi-typescript needs OpenAPI 3.x, hence the
# swagger2openapi conversion step through a temp file in between.
set -euo pipefail
cd "$(dirname "$0")/.."

SPEC="server/docs/swagger.json"
if [ ! -f "$SPEC" ]; then
  echo "error: $SPEC not found - run 'make openapi' in server/ first" >&2
  exit 1
fi

TMP="$(mktemp -t beatboxd-openapi3.XXXXXX.json)"
trap 'rm -f "$TMP"' EXIT

npx swagger2openapi "$SPEC" -o "$TMP"
npx openapi-typescript "$TMP" -o lib/api/generated.ts

echo "wrote lib/api/generated.ts"
