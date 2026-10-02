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

variable "db_app_username" {
  type        = string
  description = "Least-privilege Postgres role the API connects as."
  default     = "beatboxd_app"
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
