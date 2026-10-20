terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # State lives in S3 (versioned, encrypted, private; created once by hand,
  # see README "State"), so it survives losing this machine. use_lockfile
  # locks it with an S3 object while a plan/apply runs (no DynamoDB table).
  backend "s3" {
    bucket       = "beatboxd-terraform-state-132955065057"
    key          = "prod/terraform.tfstate"
    region       = "us-east-1"
    profile      = "beatboxd"
    encrypt      = true
    use_lockfile = true
  }
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
