output "database_url_secret_arn" {
  value = aws_secretsmanager_secret.database_url.arn
}

output "clerk_secret_key_secret_arn" {
  value = aws_secretsmanager_secret.clerk_secret_key.arn
}

output "clerk_webhook_signing_secret_secret_arn" {
  value = aws_secretsmanager_secret.clerk_webhook_signing_secret.arn
}

output "spotify_client_id_secret_arn" {
  value = aws_secretsmanager_secret.spotify_client_id.arn
}

output "spotify_client_secret_secret_arn" {
  value = aws_secretsmanager_secret.spotify_client_secret.arn
}

output "all_secret_arns" {
  value = [
    aws_secretsmanager_secret.database_url.arn,
    aws_secretsmanager_secret.clerk_secret_key.arn,
    aws_secretsmanager_secret.clerk_webhook_signing_secret.arn,
    aws_secretsmanager_secret.spotify_client_id.arn,
    aws_secretsmanager_secret.spotify_client_secret.arn,
  ]
}
