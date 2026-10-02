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

// ensureAppRole connects as the owner/master user (DATABASE_URL) and makes
// the least-privilege login role named in appDatabaseURL exist with that
// URL's password and row-level (DML-only) access to the public schema.
// Idempotent, so prod deploys run it after every `up`: re-asserting the
// password and grants keeps the role in sync with the beatboxd/database-url
// secret, and ALTER DEFAULT PRIVILEGES covers tables later migrations add.
func ensureAppRole(ctx context.Context, masterURL, appDatabaseURL string) error {
	app, err := url.Parse(appDatabaseURL)
	if err != nil {
		return fmt.Errorf("parsing APP_DATABASE_URL: %w", err)
	}
	role := app.User.Username()
	password, hasPassword := app.User.Password()
	if !roleNamePattern.MatchString(role) {
		return fmt.Errorf("APP_DATABASE_URL role %q is not a plain lowercase identifier", role)
	}
	if !hasPassword || password == "" {
		return fmt.Errorf("APP_DATABASE_URL has no password")
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
		return fmt.Errorf("APP_DATABASE_URL uses the master role %q; it must be a separate role", role)
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
		fmt.Sprintf("ALTER ROLE %s WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %s", ident, literal),
		fmt.Sprintf("GRANT CONNECT ON DATABASE %s TO %s", pgx.Identifier{app.Path[1:]}.Sanitize(), ident),
		fmt.Sprintf("GRANT USAGE ON SCHEMA public TO %s", ident),
		fmt.Sprintf("REVOKE CREATE ON SCHEMA public FROM PUBLIC, %s", ident),
		fmt.Sprintf("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %s", ident),
		fmt.Sprintf("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %s", ident),
		fmt.Sprintf("ALTER DEFAULT PRIVILEGES FOR ROLE %s IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %s", master, ident),
		fmt.Sprintf("ALTER DEFAULT PRIVILEGES FOR ROLE %s IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %s", master, ident),
		// The app has no business reading or rewriting migration state.
		fmt.Sprintf("REVOKE ALL ON TABLE schema_migrations FROM %s", ident),
	}

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
