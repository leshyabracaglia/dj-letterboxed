variable "project" {
  type = string
}

variable "db_endpoint" {
  type        = string
  description = "address:port"
}

variable "db_name" {
  type = string
}

variable "db_master_user_secret_arn" {
  type        = string
  description = "ARN of the RDS-managed master credentials secret."
}

variable "clerk_secret_key" {
  type      = string
  sensitive = true
}

variable "clerk_webhook_signing_secret" {
  type      = string
  sensitive = true
}

variable "spotify_client_id" {
  type      = string
  sensitive = true
  default   = ""
}

variable "spotify_client_secret" {
  type      = string
  sensitive = true
  default   = ""
}
