variable "project" {
  type = string
}

variable "github_repo" {
  type        = string
  description = "owner/repo, e.g. leshyabracaglia/dj-letterboxed"
}

variable "ecr_repository_arn" {
  type = string
}
