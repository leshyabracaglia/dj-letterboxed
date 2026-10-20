# Daily AWS Backup snapshots of the database, kept for
# var.backup_retention_days. RDS's own automated backups (above) only keep
# a day on this account and go with the instance if it's ever deleted;
# these recovery points live in their own vault and don't.
#
# Restore: AWS console -> AWS Backup -> Backup vaults -> <project>-db ->
# pick a recovery point -> Restore (it creates a new DB instance; point the
# app's DATABASE_URL at it, or rename it over the old one).

resource "aws_backup_vault" "db" {
  name = "${var.project}-db"
}

resource "aws_backup_plan" "db" {
  name = "${var.project}-db-daily"

  rule {
    rule_name         = "daily"
    target_vault_name = aws_backup_vault.db.name
    # 09:00 UTC (1-2am Pacific), clear of the RDS backup window above.
    schedule          = "cron(0 9 * * ? *)"
    start_window      = 60
    completion_window = 180

    lifecycle {
      delete_after = var.backup_retention_days
    }
  }
}

resource "aws_iam_role" "backup" {
  name = "${var.project}-backup"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "backup.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

resource "aws_iam_role_policy_attachment" "restore" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores"
}

resource "aws_backup_selection" "db" {
  name         = "${var.project}-db"
  plan_id      = aws_backup_plan.db.id
  iam_role_arn = aws_iam_role.backup.arn
  resources    = [aws_db_instance.this.arn]
}
