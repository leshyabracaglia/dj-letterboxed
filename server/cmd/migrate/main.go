// Command migrate applies (or rolls back) the SQL files in server/migrations
// against DATABASE_URL, using golang-migrate. Usage:
//
//	go run ./cmd/migrate up
//	go run ./cmd/migrate down 1
//	go run ./cmd/migrate app-role   # needs APP_DATABASE_URL too; see app_role.go
package main

import (
	"context"
	"errors"
	"fmt"
	"os"

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

	if args[0] == "app-role" {
		appURL := os.Getenv("APP_DATABASE_URL")
		if appURL == "" {
			return fmt.Errorf("missing APP_DATABASE_URL")
		}
		if err := ensureAppRole(context.Background(), databaseURL, appURL); err != nil {
			return err
		}
		fmt.Println("migrate: app role ready")
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
		runErr = m.Down()
	default:
		return fmt.Errorf("unknown command %q (expected up, down or app-role)", args[0])
	}

	if runErr != nil && !errors.Is(runErr, migrate.ErrNoChange) {
		return runErr
	}

	fmt.Println("migrate: done")
	return nil
}
