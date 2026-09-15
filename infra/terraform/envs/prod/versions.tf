terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # Local state to start (matches the project's current scale — no
  # collaborators yet). Migrate to an S3 backend before that changes:
  # https://developer.hashicorp.com/terraform/language/backend/s3
}

provider "aws" {
  region  = var.aws_region
  profile = "beatboxd"

  default_tags {
    tags = {
      Project   = "beatboxd"
      ManagedBy = "terraform"
    }
  }
}
