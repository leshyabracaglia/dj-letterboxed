# App-facing secrets, injected into the EC2 instance's user-data (fetched
# at boot via the instance's IAM role, never baked into the image).
#
# DATABASE_URL connects as the least-privilege `beatboxd_app` role (DML only,
# no DDL), never the RDS master user. Its password is generated here and is
# static, so AWS's rotation of the RDS-managed master password can't break
# the running API. The role itself is created/synced to this password by
# `migrate app-role` on every deploy (server/deploy/migrate.sh), which is
# also the only thing that uses the master credentials.

resource "random_password" "db_app" {
  length  = 40
  special = false
}

locals {
  database_url = "postgres://${var.db_app_username}:${random_password.db_app.result}@${var.db_endpoint}/${var.db_name}?sslmode=require"
}

resource "aws_secretsmanager_secret" "database_url" {
  name = "${var.project}/database-url"
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = local.database_url
}

resource "aws_secretsmanager_secret" "clerk_secret_key" {
  name = "${var.project}/clerk-secret-key"
}
resource "aws_secretsmanager_secret_version" "clerk_secret_key" {
  secret_id     = aws_secretsmanager_secret.clerk_secret_key.id
  secret_string = var.clerk_secret_key
}

resource "aws_secretsmanager_secret" "clerk_webhook_signing_secret" {
  name = "${var.project}/clerk-webhook-signing-secret"
}
resource "aws_secretsmanager_secret_version" "clerk_webhook_signing_secret" {
  secret_id     = aws_secretsmanager_secret.clerk_webhook_signing_secret.id
  secret_string = var.clerk_webhook_signing_secret
}

resource "aws_secretsmanager_secret" "spotify_client_id" {
  name = "${var.project}/spotify-client-id"
}
resource "aws_secretsmanager_secret_version" "spotify_client_id" {
  secret_id = aws_secretsmanager_secret.spotify_client_id.id
  # Secrets Manager rejects an empty string as a value; djs.searchSpotify
  # already fails open (returns []) on a bad/missing credential, so an
  # "unset" placeholder is functionally equivalent to not having one yet.
  secret_string = var.spotify_client_id != "" ? var.spotify_client_id : "unset"
}

resource "aws_secretsmanager_secret" "spotify_client_secret" {
  name = "${var.project}/spotify-client-secret"
}
resource "aws_secretsmanager_secret_version" "spotify_client_secret" {
  secret_id     = aws_secretsmanager_secret.spotify_client_secret.id
  secret_string = var.spotify_client_secret != "" ? var.spotify_client_secret : "unset"
}

# Reaches the instance via server/deploy/refresh-env.sh on each deploy, not
# user_data (see the note there). The API treats "unset" as no key, so place
# search reports itself unconfigured (503) until a real one is set.
resource "aws_secretsmanager_secret" "google_places_api_key" {
  name = "${var.project}/google-places-api-key"
}
resource "aws_secretsmanager_secret_version" "google_places_api_key" {
  secret_id     = aws_secretsmanager_secret.google_places_api_key.id
  secret_string = var.google_places_api_key != "" ? var.google_places_api_key : "unset"
}
