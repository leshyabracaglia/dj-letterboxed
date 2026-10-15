variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project" {
  type    = string
  default = "beatboxd"
}

variable "domain_name" {
  type        = string
  description = "Full API domain, e.g. api.beatboxd.com"
  default     = "api.beatboxd.com"
}

variable "github_repo" {
  type    = string
  default = "leshyabracaglia/dj-letterboxed"
}

variable "clerk_jwks_url" {
  type = string
}

variable "clerk_issuer" {
  type = string
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

variable "google_places_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

# Content report emails via Resend (optional): the API key, and the address
# reports go to - the Resend account's own address unless a domain is verified.
variable "resend_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "reports_email" {
  type    = string
  default = ""
}
