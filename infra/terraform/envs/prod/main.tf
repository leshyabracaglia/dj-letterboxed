# Cost-minimized architecture: the account's existing default VPC (no NAT
# Gateway, no custom VPC needed) + one free-tier-eligible EC2 instance
# running Docker Compose (Go API + Caddy, which gets its own Let's Encrypt
# cert) + one free-tier-eligible RDS Postgres instance. No ALB, no ECS,
# no Aurora — those cost real money with no free tier; see infra/terraform/README.md
# for the fuller ECS/Aurora design this replaced, kept for later if traffic
# ever outgrows a single instance.

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_security_group" "app" {
  name        = "${var.project}-app-sg"
  description = "Allow inbound HTTP/HTTPS from the internet to the app instance"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project}-app-sg" }
}

resource "aws_security_group" "db" {
  name        = "${var.project}-db-sg"
  description = "Allow Postgres from the app instance only"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project}-db-sg" }
}

module "ecr" {
  source  = "../../modules/ecr"
  project = var.project
}

module "database" {
  source            = "../../modules/database"
  project           = var.project
  subnet_ids        = data.aws_subnets.default.ids
  security_group_id = aws_security_group.db.id
}

module "secrets" {
  source                       = "../../modules/secrets"
  project                      = var.project
  db_endpoint                  = module.database.endpoint
  db_name                      = module.database.database_name
  db_master_user_secret_arn    = module.database.master_user_secret_arn
  clerk_secret_key             = var.clerk_secret_key
  clerk_webhook_signing_secret = var.clerk_webhook_signing_secret
  spotify_client_id            = var.spotify_client_id
  spotify_client_secret        = var.spotify_client_secret
}

module "ec2" {
  source = "../../modules/ec2"

  project            = var.project
  aws_region         = var.aws_region
  domain_name        = var.domain_name
  vpc_id             = data.aws_vpc.default.id
  subnet_id          = data.aws_subnets.default.ids[0]
  security_group_id  = aws_security_group.app.id
  ecr_repository_url = module.ecr.repository_url

  database_url_secret_arn                 = module.secrets.database_url_secret_arn
  clerk_secret_key_secret_arn             = module.secrets.clerk_secret_key_secret_arn
  clerk_webhook_signing_secret_secret_arn = module.secrets.clerk_webhook_signing_secret_secret_arn
  spotify_client_id_secret_arn            = module.secrets.spotify_client_id_secret_arn
  spotify_client_secret_secret_arn        = module.secrets.spotify_client_secret_secret_arn
  clerk_jwks_url                          = var.clerk_jwks_url
  clerk_issuer                            = var.clerk_issuer
}

module "github_oidc" {
  source = "../../modules/github_oidc"

  project            = var.project
  github_repo        = var.github_repo
  ecr_repository_arn = module.ecr.repository_arn
}
