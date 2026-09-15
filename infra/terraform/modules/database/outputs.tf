output "address" {
  value = aws_db_instance.this.address
}

output "endpoint" {
  description = "address:port"
  value       = aws_db_instance.this.endpoint
}

output "port" {
  value = aws_db_instance.this.port
}

output "database_name" {
  value = aws_db_instance.this.db_name
}

output "master_username" {
  value = aws_db_instance.this.username
}

output "master_user_secret_arn" {
  description = "ARN of the RDS-managed Secrets Manager secret holding the master password."
  value       = aws_db_instance.this.master_user_secret[0].secret_arn
}
