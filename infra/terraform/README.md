# beatboxd AWS infrastructure

Cost-minimized version: the account's default VPC (no custom VPC, no NAT
Gateway) + one free-tier-eligible EC2 instance (`t3.micro`) running Docker
Compose — the Go API container plus a Caddy container in front of it, which
gets its own Let's Encrypt certificate automatically — + one free-tier-
eligible RDS Postgres instance (`db.t3.micro`, not Aurora — Aurora has no
free tier at any instance class). No ALB, no ECS, no ACM certificate to
manage manually.

All commands below assume the `beatboxd` AWS CLI profile (never root):

```
export AWS_PROFILE=beatboxd
cd infra/terraform/envs/prod
```

## First-time setup

1. `terraform init`
2. Copy `terraform.tfvars.example` to `terraform.tfvars` and fill in real
   values (Clerk JWKS URL/issuer/secret key/webhook signing secret, Spotify
   creds if you have them). This file is gitignored — never commit it.
3. `terraform apply`

This creates the security groups, RDS instance, ECR repo, the EC2 instance
(with its Elastic IP), Secrets Manager entries, and the GitHub OIDC deploy
role — no manual DNS dance needed before this step, unlike the earlier
ALB-based design.

## After apply

1. `terraform output app_public_ip` → add an **A record** at GoDaddy for
   `api.beatboxd.com` pointing at that IP.
2. Once DNS resolves (check with `dig +short api.beatboxd.com`), Caddy on
   the instance will automatically request and renew a Let's Encrypt
   certificate the first time it sees a request for that domain — no
   action needed, just wait a minute or two after DNS propagates and hit
   `https://api.beatboxd.com/healthz`.
3. **The instance starts with no image to run** on a from-scratch apply —
   `user_data` runs `docker compose pull` against `<ecr_repository_url>:latest`,
   which doesn't exist yet. Push one manually to bootstrap:
   ```
   aws ecr get-login-password --profile beatboxd --region us-east-1 | \
     docker login --username AWS --password-stdin $(terraform output -raw ecr_repository_url | cut -d/ -f1)
   docker build -t $(terraform output -raw ecr_repository_url):latest ../../../server
   docker push $(terraform output -raw ecr_repository_url):latest
   ```
   Then redeploy onto the running instance via SSM (no SSH needed):
   ```
   aws ssm send-command --profile beatboxd \
     --instance-ids $(terraform output -raw app_instance_id) \
     --document-name "AWS-RunShellScript" \
     --parameters 'commands=["cd /opt/beatboxd && aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin '"$(terraform output -raw ecr_repository_url | cut -d/ -f1)"'","docker compose pull","docker compose up -d"]'
   ```
   This is also exactly what Phase 3's `server-deploy.yml` CI workflow
   automates going forward.

4. **Run migrations against the new RDS instance** — from a machine that
   can reach it. The instance itself is the simplest path since it's
   already inside the same security-group boundary: SSM into it
   (`aws ssm start-session --profile beatboxd --target $(terraform output -raw app_instance_id)`)
   and run the `migrate` binary there, or temporarily open port 5432 on
   `aws_security_group.db` to your own IP and run `make migrate-up`
   locally against `DATABASE_URL` (revert the security group rule after).

5. **Dedicated app DB role**: the `DATABASE_URL` secret this module
   creates points at the RDS **master** user for now, so the stack is
   usable immediately. Connect once with the master credentials (from the
   Secrets Manager secret Terraform references) and run:
   ```sql
   CREATE ROLE beatboxd_app WITH LOGIN PASSWORD '...';
   GRANT ALL PRIVILEGES ON DATABASE beatboxd TO beatboxd_app;
   GRANT ALL ON ALL TABLES IN SCHEMA public TO beatboxd_app;
   GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO beatboxd_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO beatboxd_app;
   ```
   then update the `database_url` secret (`modules/secrets/main.tf`) to use
   `beatboxd_app` instead of the master user, and re-apply (this changes
   the `.env` file `user_data` writes on next instance replacement — for
   an in-place update, re-run the SSM deploy command above after rotating
   the secret so the running container picks up the new DSN).

6. **GitHub Actions**: put `terraform output -raw github_deploy_role_arn`
   into the repo's Actions secrets/vars as `AWS_DEPLOY_ROLE_ARN` — Phase 3's
   `server-deploy.yml` assumes this role via OIDC and runs the same
   build → push → SSM-redeploy sequence as the manual bootstrap above.

## Why these choices (and what changed from the original ECS/Aurora design)

The plan originally called for ECS Fargate + Aurora Serverless v2 + an ALB
— solid architecture, but **none of those three have a free tier**, and
together they run roughly $70-100+/mo even at minimal scale (the NAT
Gateway alone is ~$30+/mo just for the hourly charge). Once that became a
concern, this got rescoped to the cheapest reasonable option:

- **One EC2 instance instead of ECS Fargate**: `t3.micro` is free-tier
  eligible (750 hrs/mo for a new account's first 12 months); Fargate has
  no free tier regardless of account age. Trade-off: no auto-scaling, no
  rolling deploys, a single point of failure — acceptable for a side
  project's current traffic, revisit if that changes.
- **Plain RDS instead of Aurora**: `db.t3.micro` is free-tier eligible;
  Aurora isn't, at any instance class or engine mode.
- **No ALB, no ACM certificate**: Caddy on the instance handles TLS itself
  via Let's Encrypt (HTTP-01 challenge on port 80), which is free and
  removes the ALB's non-free hourly + LCU charges entirely.
- **Default VPC instead of a custom one**: no NAT Gateway needed since the
  instance sits in a public subnet directly (with a tight security group);
  removes the single priciest line item from the original design.
- **Local Terraform state** (no S3 backend configured yet): fine solo, at
  this scale. Move to an S3 backend before collaborating with anyone else
  or running `apply` from more than one machine.

If traffic ever outgrows a single instance, the original ECS/Aurora/ALB
module designs (VPC with NAT, ECS Fargate service, Aurora Serverless v2,
ACM+ALB) are a reasonable next step — they were fully written and
`terraform plan`-verified against this AWS account before being replaced
by this cheaper version, so re-adding them later is a known, previously-
working path if/when the cost becomes worth it.

**Caveat on "free"**: this is only genuinely ~$0/mo if the AWS account is
within its first 12 months (free tier is account-age-gated, not something
Terraform can verify or enforce). If the account is older than that, this
still runs meaningfully cheaper than the ECS/Aurora/ALB design (roughly
$15-25/mo instead of $70-100+/mo), just not literally free.
