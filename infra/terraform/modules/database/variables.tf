variable "project" {
  type = string
}

variable "subnet_ids" {
  type        = list(string)
  description = "At least 2, in different AZs (RDS requires this for the subnet group even in single-AZ deployment mode)."
}

variable "security_group_id" {
  type = string
}

variable "database_name" {
  type    = string
  default = "beatboxd"
}

variable "master_username" {
  type    = string
  default = "beatboxd_admin"
}

variable "engine_version" {
  type        = string
  description = "PostgreSQL engine version. Must be >= 13 (gen_random_uuid() built-in, no pgcrypto extension needed)."
  default     = "16.15"
}

variable "instance_class" {
  type        = string
  default     = "db.t3.micro"
  description = "db.t3.micro (not db.t4g.micro) to stay inside the standard 12-month RDS Free Tier's most broadly eligible class."
}
