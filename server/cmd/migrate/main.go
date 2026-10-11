// Command migrate applies (or rolls back) the SQL files in server/migrations
// against DATABASE_URL, using golang-migrate. Usage:
//
//	go run ./cmd/migrate up
//	go run ./cmd/migrate down 1
//	go run ./cmd/migrate app-role        # needs APP_DATABASE_URL too; see app_role.go
//	go run ./cmd/migrate readonly-role   # needs READONLY_DATABASE_URL too
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strconv"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "migrate:", err)
		os.Exit(1)
	}
}

func run() error {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return fmt.Errorf("missing DATABASE_URL")
	}

	args := os.Args[1:]
	if len(args) == 0 {
		args = []string{"up"}
	}

	if level, ok := roleCommands[args[0]]; ok {
		roleURL := os.Getenv(level.envVar)
		if roleURL == "" {
			return fmt.Errorf("missing %s", level.envVar)
		}
		if err := ensureRole(context.Background(), databaseURL, roleURL, level); err != nil {
			return err
		}
		fmt.Printf("migrate: %s ready\n", args[0])
		return nil
	}

	dir := os.Getenv("MIGRATIONS_DIR")
	if dir == "" {
		dir = "migrations"
	}

	m, err := migrate.New("file://"+dir, databaseURL)
	if err != nil {
		return fmt.Errorf("initializing migrator: %w", err)
	}
	defer m.Close()

	var runErr error
	switch args[0] {
	case "up":
		runErr = m.Up()
	case "down":
		// "down N" rolls back the last N migrations; bare "down" rolls back
		// all of them (what `make reset-db` wants).
		if len(args) > 1 {
			n, err := strconv.Atoi(args[1])
			if err != nil || n < 1 {
				return fmt.Errorf("down takes a positive number of migrations, got %q", args[1])
			}
			runErr = m.Steps(-n)
		} else {
			runErr = m.Down()
		}
	default:
		return fmt.Errorf("unknown command %q (expected up, down, app-role or readonly-role)", args[0])
	}

	if runErr != nil && !errors.Is(runErr, migrate.ErrNoChange) {
		return runErr
	}

	fmt.Println("migrate: done")
	return nil
}
