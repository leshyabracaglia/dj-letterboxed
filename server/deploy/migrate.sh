#!/bin/bash
# Runs schema migrations as the RDS master user, then (re)asserts the
# least-privilege app role, in a one-off container from the freshly pulled
# image. Run by server-deploy.yml (via SSM) after refresh-env.sh and before
# `docker compose up`.
#
# Usage: migrate.sh <rds-master-user-secret-arn>
#
# The master password is RDS-managed and rotated by AWS, so it's fetched
# fresh on every run and only ever handed to the migrate container — it is
# never written to .env, so the long-running API container can't see it.
# The API itself connects as the limited role in .env's DATABASE_URL.
set -euo pipefail

MASTER_SECRET_ARN="${1:?usage: migrate.sh <rds-master-user-secret-arn>}"
REGION="${AWS_REGION:-us-east-1}"
ENV_FILE="${ENV_FILE:-/opt/beatboxd/.env}"

APP_DATABASE_URL=$(grep '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2-)
MASTER_CREDS=$(aws secretsmanager get-secret-value --region "$REGION" \
  --secret-id "$MASTER_SECRET_ARN" --query SecretString --output text)

# Same host/db/options as the app URL, master username/password swapped in.
MASTER_DATABASE_URL=$(APP_URL="$APP_DATABASE_URL" CREDS="$MASTER_CREDS" python3 -c '
import json, os, urllib.parse as u
c = json.loads(os.environ["CREDS"])
a = u.urlsplit(os.environ["APP_URL"])
host = a.hostname + (":%d" % a.port if a.port else "")
userinfo = "%s:%s" % (u.quote(c["username"], safe=""), u.quote(c["password"], safe=""))
print(u.urlunsplit((a.scheme, userinfo + "@" + host, a.path, a.query, "")))')

# Passed by name (-e VAR, no value) so neither URL shows up in argv.
export APP_DATABASE_URL
export DATABASE_URL="$MASTER_DATABASE_URL"
docker compose run --rm --no-deps -e DATABASE_URL --entrypoint /app/migrate api up
docker compose run --rm --no-deps -e DATABASE_URL -e APP_DATABASE_URL --entrypoint /app/migrate api app-role
