output "app_public_ip" {
  description = "Add an A record at GoDaddy: api.beatboxd.com -> this IP. Caddy on the instance gets its own Let's Encrypt cert automatically once that resolves."
  value       = module.ec2.public_ip
}

output "app_instance_id" {
  value = module.ec2.instance_id
}

output "ecr_repository_url" {
  value = module.ecr.repository_url
}

output "github_deploy_role_arn" {
  description = "Put this in the repo's GitHub Actions secrets/vars as AWS_DEPLOY_ROLE_ARN."
  value       = module.github_oidc.deploy_role_arn
}

output "db_endpoint" {
  value = module.database.endpoint
}
