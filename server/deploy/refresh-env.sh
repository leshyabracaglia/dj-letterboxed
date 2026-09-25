#!/bin/bash
# Re-reads the Secrets Manager-backed values in /opt/beatboxd/.env on the
# app instance. user_data only writes .env on first boot, so without this a
# rotated secret never reaches the running container short of replacing the
# instance. Run by server-deploy.yml (via SSM) before `docker compose up`.
#
# Only the secret-backed keys are rewritten; the rest of .env (CLERK_JWKS_URL,
# CLERK_ISSUER, PORT — baked in from Terraform vars by user_data) is kept as-is.
# Keep the key → secret-name list in sync with modules/secrets/main.tf and
# modules/ec2/templates/user_data.sh.tftpl.
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
ENV_FILE="${ENV_FILE:-/opt/beatboxd/.env}"

SECRETS=(
  "DATABASE_URL=beatboxd/database-url"
  "CLERK_SECRET_KEY=beatboxd/clerk-secret-key"
  "CLERK_WEBHOOK_SIGNING_SECRET=beatboxd/clerk-webhook-signing-secret"
  "SPOTIFY_CLIENT_ID=beatboxd/spotify-client-id"
  "SPOTIFY_CLIENT_SECRET=beatboxd/spotify-client-secret"
)

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

# Start from the existing file minus the keys we're about to refresh.
pattern=$(printf '%s\n' "${SECRETS[@]}" | cut -d= -f1 | sed 's/.*/^&=/' | paste -sd'|' -)
grep -Ev "$pattern" "$ENV_FILE" > "$tmp" || true

# Fetch everything before touching .env, so a failed fetch aborts the deploy
# instead of leaving the container with a half-written file.
for entry in "${SECRETS[@]}"; do
  key="${entry%%=*}"
  name="${entry#*=}"
  value=$(aws secretsmanager get-secret-value --region "$REGION" --secret-id "$name" \
    --query SecretString --output text)
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
done

install -m 600 "$tmp" "$ENV_FILE"
echo "Refreshed ${#SECRETS[@]} secret-backed values in $ENV_FILE"
