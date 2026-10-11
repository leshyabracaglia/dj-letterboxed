package main

import (
	"context"
	"fmt"
	"net/url"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
)

var roleNamePattern = regexp.MustCompile(`^[a-z_][a-z0-9_]*$`)

// roleLevel is what a login role may do with the public schema's rows.
type roleLevel struct {
	envVar   string // the env var holding the role's connection URL
	readOnly bool
}

// The `migrate <command>` that syncs each role.
var roleCommands = map[string]roleLevel{
	// The API's role: row-level (DML-only) access.
	"app-role": {envVar: "APP_DATABASE_URL"},
	// For people inspecting prod (scripts/prod-db.sh): SELECT only, and every
	// transaction read-only by default as a second guard.
	"readonly-role": {envVar: "READONLY_DATABASE_URL", readOnly: true},
}

// ensureRole connects as the owner/master user (DATABASE_URL) and makes the
// least-privilege login role named in roleURL exist with that URL's
// password and the level's access to the public schema. Idempotent, so prod
// deploys run it after every `up`: re-asserting the password and grants
// keeps the role in sync with its Secrets Manager URL, and ALTER DEFAULT
// PRIVILEGES covers tables later migrations add.
func ensureRole(ctx context.Context, masterURL, roleURL string, level roleLevel) error {
	parsed, err := url.Parse(roleURL)
	if err != nil {
		return fmt.Errorf("parsing %s: %w", level.envVar, err)
	}
	role := parsed.User.Username()
	password, hasPassword := parsed.User.Password()
	if !roleNamePattern.MatchString(role) {
		return fmt.Errorf("%s role %q is not a plain lowercase identifier", level.envVar, role)
	}
	if !hasPassword || password == "" {
		return fmt.Errorf("%s has no password", level.envVar)
	}

	conn, err := pgx.Connect(ctx, masterURL)
	if err != nil {
		return fmt.Errorf("connecting as master: %w", err)
	}
	defer conn.Close(ctx)

	var masterRole string
	if err := conn.QueryRow(ctx, "SELECT current_user").Scan(&masterRole); err != nil {
		return err
	}
	if masterRole == role {
		return fmt.Errorf("%s uses the master role %q; it must be a separate role", level.envVar, role)
	}

	ident := pgx.Identifier{role}.Sanitize()
	master := pgx.Identifier{masterRole}.Sanitize()
	// Role DDL can't take bind parameters, so the password is inlined as an
	// escaped literal (standard_conforming_strings is on by default).
	literal := "'" + strings.ReplaceAll(password, "'", "''") + "'"

	stmts := []string{
		fmt.Sprintf(`DO $$ BEGIN
			IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = %s) THEN
				CREATE ROLE %s LOGIN;
			END IF;
		END $$`, "'"+role+"'", ident),
		// Just LOGIN + password: new roles already default to NOSUPERUSER/
		// NOCREATEDB/NOCREATEROLE, and RDS's master isn't a true superuser,
		// so naming those attributes here is rejected (42501) there.
		fmt.Sprintf("ALTER ROLE %s WITH LOGIN PASSWORD %s", ident, literal),
		fmt.Sprintf("GRANT CONNECT ON DATABASE %s TO %s", pgx.Identifier{parsed.Path[1:]}.Sanitize(), ident),
		fmt.Sprintf("GRANT USAGE ON SCHEMA public TO %s", ident),
		fmt.Sprintf("REVOKE CREATE ON SCHEMA public FROM PUBLIC, %s", ident),
	}
	if level.readOnly {
		stmts = append(stmts,
			fmt.Sprintf("GRANT SELECT ON ALL TABLES IN SCHEMA public TO %s", ident),
			fmt.Sprintf("ALTER DEFAULT PRIVILEGES FOR ROLE %s IN SCHEMA public GRANT SELECT ON TABLES TO %s", master, ident),
			fmt.Sprintf("ALTER ROLE %s SET default_transaction_read_only = on", ident),
		)
	} else {
		stmts = append(stmts,
			fmt.Sprintf("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %s", ident),
			fmt.Sprintf("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %s", ident),
			fmt.Sprintf("ALTER DEFAULT PRIVILEGES FOR ROLE %s IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %s", master, ident),
			fmt.Sprintf("ALTER DEFAULT PRIVILEGES FOR ROLE %s IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %s", master, ident),
		)
	}
	// Neither role has any business reading or rewriting migration state.
	stmts = append(stmts, fmt.Sprintf("REVOKE ALL ON TABLE schema_migrations FROM %s", ident))

	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	for _, stmt := range stmts {
		if _, err := tx.Exec(ctx, stmt); err != nil {
			// Never echo the statement: it may carry the password.
			return fmt.Errorf("configuring role %s: %w", role, err)
		}
	}
	return tx.Commit(ctx)
}
