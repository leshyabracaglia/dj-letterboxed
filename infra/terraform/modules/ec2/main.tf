# Single free-tier-eligible EC2 instance running Docker Compose: the Go
# API container plus a Caddy container in front of it, which gets its own
# Let's Encrypt certificate automatically (HTTP-01 challenge on port 80) —
# no ALB, no ACM certificate needed for this path.

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    # Note the "20" right after "al2023-ami-": this deliberately excludes
    # the "al2023-ami-minimal-*" variant, which doesn't ship the SSM agent
    # (learned the hard way - a minimal-variant instance is unreachable by
    # anything, since this stack has no SSH key/port 22 either).
    name   = "name"
    values = ["al2023-ami-20*-x86_64"]
  }
  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "instance" {
  name               = "${var.project}-ec2"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

# SSM Session Manager access instead of opening port 22 / managing SSH keys.
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "instance_permissions" {
  statement {
    sid       = "ECRAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    sid = "ECRPull"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
    ]
    resources = ["*"]
  }
  statement {
    sid     = "SecretsRead"
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      var.database_url_secret_arn,
      var.clerk_secret_key_secret_arn,
      var.clerk_webhook_signing_secret_secret_arn,
      var.spotify_client_id_secret_arn,
      var.spotify_client_secret_secret_arn,
    ]
  }
}

resource "aws_iam_role_policy" "instance" {
  name   = "${var.project}-ec2"
  role   = aws_iam_role.instance.id
  policy = data.aws_iam_policy_document.instance_permissions.json
}

resource "aws_iam_instance_profile" "this" {
  name = "${var.project}-ec2"
  role = aws_iam_role.instance.name
}

resource "aws_eip" "this" {
  domain = "vpc"
  tags   = { Name = "${var.project}-app-eip" }
}

resource "aws_instance" "this" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [var.security_group_id]
  iam_instance_profile   = aws_iam_instance_profile.this.name

  # Registry hostname (no repo path) — Docker login needs just the host.
  user_data = templatefile("${path.module}/templates/user_data.sh.tftpl", {
    aws_region                              = var.aws_region
    ecr_registry                            = split("/", var.ecr_repository_url)[0]
    ecr_repository_url                      = var.ecr_repository_url
    domain_name                             = var.domain_name
    database_url_secret_arn                 = var.database_url_secret_arn
    clerk_secret_key_secret_arn             = var.clerk_secret_key_secret_arn
    clerk_webhook_signing_secret_secret_arn = var.clerk_webhook_signing_secret_secret_arn
    spotify_client_id_secret_arn            = var.spotify_client_id_secret_arn
    spotify_client_secret_secret_arn        = var.spotify_client_secret_secret_arn
    clerk_jwks_url                          = var.clerk_jwks_url
    clerk_issuer                            = var.clerk_issuer
  })
  user_data_replace_on_change = true

  tags = { Name = "${var.project}-app" }
}

resource "aws_eip_association" "this" {
  instance_id   = aws_instance.this.id
  allocation_id = aws_eip.this.id
}
