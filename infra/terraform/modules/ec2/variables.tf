variable "project" {
  type = string
}

variable "instance_type" {
  type        = string
  default     = "t3.micro"
  description = "t3.micro (not t4g.micro) to stay inside the standard 12-month EC2 Free Tier."
}

variable "aws_region" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_id" {
  type = string
}

variable "security_group_id" {
  type = string
}

variable "domain_name" {
  type        = string
  description = "e.g. api.beatboxd.com. Point an A record here at the Elastic IP output."
}

variable "ecr_repository_url" {
  type = string
}

variable "database_url_secret_arn" {
  type = string
}

variable "clerk_secret_key_secret_arn" {
  type = string
}

variable "clerk_webhook_signing_secret_secret_arn" {
  type = string
}

variable "spotify_client_id_secret_arn" {
  type = string
}

variable "spotify_client_secret_secret_arn" {
  type = string
}

variable "clerk_jwks_url" {
  type = string
}

variable "clerk_issuer" {
  type = string
}
