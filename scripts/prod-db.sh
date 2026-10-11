#!/usr/bin/env bash
# Read-only access to the production database, which is private RDS reachable
# only from inside the VPC: everything goes through the beatboxd-app EC2
# instance over SSM, logged in as the SELECT-only `beatboxd_readonly` role
# (server/cmd/migrate/app_role.go), so nothing here can change data.
#
#   npm run db:prod                          tunnel to localhost:5434 and open it
#                                            in TablePlus/Postico (Ctrl-C closes)
#   npm run db:prod:query -- "SELECT …"      run one query on the instance
#   npm run db:prod:query -- path/to/q.sql
#
# Needs the AWS CLI logged in as the `beatboxd` profile; the tunnel also needs
# `brew install --cask session-manager-plugin`. Override with AWS_PROFILE,
# AWS_REGION, PROD_DB_PORT.
set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-beatboxd}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
# 5433 is the local docker-compose Postgres.
PROD_DB_PORT="${PROD_DB_PORT:-5434}"
SECRET_ID="beatboxd/database-url-readonly"

die() {
  echo "prod-db: $*" >&2
  exit 1
}

# Looked up by tag, like server-deploy.yml: the instance ID changes whenever
# it's replaced.
instance_id() {
  local id
  id=$(aws ec2 describe-instances \
    --filters Name=tag:Name,Values=beatboxd-app Name=instance-state-name,Values=running \
    --query 'Reservations[0].Instances[0].InstanceId' --output text)
  [ -n "$id" ] && [ "$id" != None ] || die "no running beatboxd-app instance"
  echo "$id"
}

tunnel() {
  command -v session-manager-plugin >/dev/null ||
    die "needs the SSM plugin: brew install --cask session-manager-plugin"

  local url iid
  url=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ID" --query SecretString --output text) ||
    die "can't read $SECRET_ID (terraform apply not run yet, or not logged in to AWS?)"
  iid=$(instance_id)

  # The same URL with the RDS host swapped for the local end of the tunnel.
  local host local_url
  read -r host local_url < <(URL="$url" PORT="$PROD_DB_PORT" python3 -c '
import os, urllib.parse as u
p = u.urlsplit(os.environ["URL"])
userinfo = p.netloc.rsplit("@", 1)[0]
print(p.hostname, u.urlunsplit((p.scheme, userinfo + "@localhost:" + os.environ["PORT"], p.path, p.query, "")))')

  if nc -z localhost "$PROD_DB_PORT" 2>/dev/null; then
    die "port $PROD_DB_PORT is already in use (set PROD_DB_PORT to pick another)"
  fi

  echo "Opening a tunnel to $host via $iid…"
  aws ssm start-session --target "$iid" \
    --document-name AWS-StartPortForwardingSessionToRemoteHost \
    --parameters "host=$host,portNumber=5432,localPortNumber=$PROD_DB_PORT" >/dev/null &
  local pid=$!
  trap 'kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null; echo; echo "Tunnel closed."' EXIT

  for _ in $(seq 1 60); do
    nc -z localhost "$PROD_DB_PORT" 2>/dev/null && break
    kill -0 "$pid" 2>/dev/null || die "the SSM session exited before the tunnel came up"
    sleep 0.5
  done
  nc -z localhost "$PROD_DB_PORT" 2>/dev/null || die "timed out waiting for the tunnel"

  echo
  echo "Connected (read-only). Connection URL:"
  echo "  $local_url"
  echo
  # TablePlus and Postico both register postgres:// on macOS.
  open "$local_url" 2>/dev/null || echo "(No app handles postgres:// URLs; paste the URL into your DB client.)"
  echo "Press Ctrl-C to close the tunnel."
  wait "$pid"
}

query() {
  local sql="${1:-}"
  [ -n "$sql" ] || die 'usage: npm run db:prod:query -- "SELECT …" (or a .sql file)'
  [ -f "$sql" ] && sql=$(cat "$sql")

  local iid
  iid=$(instance_id)

  # Shipped base64'd so no quoting survives into the remote shell. The
  # instance fetches the read-only URL itself (its role can read the secret),
  # and PGOPTIONS is a second read-only guard on top of the role's own.
  local b64 cmd params
  b64=$(printf '%s' "$sql" | base64 | tr -d '\n')
  cmd="set -e; URL=\$(aws secretsmanager get-secret-value --region $AWS_REGION --secret-id $SECRET_ID --query SecretString --output text); echo $b64 | base64 -d | docker run --rm -i -e URL -e PGOPTIONS='-c default_transaction_read_only=on' postgres:16-alpine sh -c 'psql \"\$URL\" -v ON_ERROR_STOP=1 -x -f -'"
  params=$(CMD="$cmd" python3 -c 'import json, os; print(json.dumps({"commands": [os.environ["CMD"]]}))')

  local cid status
  cid=$(aws ssm send-command --instance-ids "$iid" --document-name AWS-RunShellScript \
    --parameters "$params" --query Command.CommandId --output text)
  for _ in $(seq 1 60); do
    status=$(aws ssm get-command-invocation --command-id "$cid" --instance-id "$iid" \
      --query Status --output text 2>/dev/null || echo Pending)
    case "$status" in Pending | InProgress | Delayed) sleep 1 ;; *) break ;; esac
  done

  aws ssm get-command-invocation --command-id "$cid" --instance-id "$iid" \
    --query StandardOutputContent --output text
  if [ "$status" != Success ]; then
    # Drop docker's image-pull progress; keep psql's errors.
    aws ssm get-command-invocation --command-id "$cid" --instance-id "$iid" \
      --query StandardErrorContent --output text | grep -vE '^[0-9a-f]{12}: |^(Digest|Status|Unable to find image|16-alpine: Pulling)' >&2
    die "query failed ($status)"
  fi
}

case "${1:-}" in
  tunnel) tunnel ;;
  query) shift; query "$@" ;;
  *) die "usage: prod-db.sh tunnel | query \"SELECT …\"" ;;
esac
