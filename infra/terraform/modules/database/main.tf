# Plain RDS PostgreSQL, single-AZ, db.t3.micro — free-tier eligible (Aurora
# has NO free tier at any instance class, which is why this isn't Aurora).
# Not publicly accessible; reachable only from the app's security group.
# Uses RDS-managed master credentials (rotated by AWS) rather than a
# hand-picked password; a dedicated least-privilege beatboxd_app role
# should be created post-provisioning (see infra/terraform/README.md)
# rather than using this master user from the running application.

resource "aws_db_subnet_group" "this" {
  name       = "${var.project}-db-subnets"
  subnet_ids = var.subnet_ids
  tags       = { Name = "${var.project}-db-subnets" }
}

resource "aws_db_instance" "this" {
  identifier     = "${var.project}-db"
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name                     = var.database_name
  username                    = var.master_username
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [var.security_group_id]
  publicly_accessible    = false
  multi_az                = false

  # Free-tier accounts cap backup retention below RDS's normal default;
  # 1 day is the safe minimum that still gets you same-day point-in-time
  # recovery. Raise this once off free tier if you want more history.
  backup_retention_period = 1
  backup_window           = "07:00-08:00"
  skip_final_snapshot     = false
  final_snapshot_identifier = "${var.project}-db-final"

  tags = { Name = "${var.project}-db" }
}
