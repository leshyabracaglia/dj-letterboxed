# App-facing secrets, injected into the EC2 instance's user-data (fetched
# at boot via the instance's IAM role, never baked into the image).
# DATABASE_URL is assembled from the RDS-managed master credentials secret
# + endpoint.
#
# NOTE: this wires the app to the RDS *master* user for the initial
# provisioning pass. Per infra/terraform/README.md, create a dedicated
# least-privilege `beatboxd_app` Postgres role post-provisioning and swap
# this secret to use it instead — flagged in the migration plan as a
# follow-up, not a blocker for getting the stack live.

data "aws_secretsmanager_secret_version" "db_master" {
  secret_id = var.db_master_user_secret_arn
}

locals {
  db_master_creds = jsondecode(data.aws_secretsmanager_secret_version.db_master.secret_string)
  database_url    = "postgres://${local.db_master_creds.username}:${urlencode(local.db_master_creds.password)}@${var.db_endpoint}/${var.db_name}?sslmode=require"
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
