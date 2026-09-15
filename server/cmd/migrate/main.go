// Command migrate applies (or rolls back) the SQL files in server/migrations
// against DATABASE_URL, using golang-migrate. Usage:
//
//	go run ./cmd/migrate up
//	go run ./cmd/migrate down 1
package main

import (
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

	dir := os.Getenv("MIGRATIONS_DIR")
	if dir == "" {
		dir = "migrations"
	}

	m, err := migrate.New("file://"+dir, databaseURL)
	if err != nil {
		return fmt.Errorf("initializing migrator: %w", err)
	}
	defer m.Close()

	args := os.Args[1:]
	if len(args) == 0 {
		args = []string{"up"}
	}

	var runErr error
	switch args[0] {
	case "up":
		runErr = m.Up()
	case "down":
		runErr = m.Down()
	default:
		return fmt.Errorf("unknown command %q (expected up or down)", args[0])
	}

	if runErr != nil && !errors.Is(runErr, migrate.ErrNoChange) {
		return runErr
	}

	fmt.Println("migrate: done")
	return nil
}
