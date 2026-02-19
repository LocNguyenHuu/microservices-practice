// Package db provides database utilities including a lightweight migration runner.
// Migrations are applied in filename order and tracked in a schema_migrations table.
package db

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jmoiron/sqlx"
)

// RunMigrations applies pending SQL migration files from the given directory.
// Each migration is executed within a transaction to ensure atomicity — if the
// SQL fails, the migration is not recorded and can be retried.
func RunMigrations(db *sqlx.DB, migrationsDir string) error {
	// Ensure the migrations tracking table exists
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("create migrations table: %w", err)
	}

	// Find all *.up.sql files and sort by filename (001_, 002_, etc.)
	files, err := filepath.Glob(filepath.Join(migrationsDir, "*.up.sql"))
	if err != nil {
		return fmt.Errorf("read migration files: %w", err)
	}
	sort.Strings(files)

	for _, file := range files {
		version := strings.TrimSuffix(filepath.Base(file), ".up.sql")

		// Skip already-applied migrations
		var count int
		err := db.Get(&count, "SELECT COUNT(*) FROM schema_migrations WHERE version = $1", version)
		if err != nil {
			return fmt.Errorf("check migration %s: %w", version, err)
		}
		if count > 0 {
			continue
		}

		content, err := os.ReadFile(file)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", version, err)
		}

		// Apply migration + record in a single transaction for atomicity
		tx, err := db.Beginx()
		if err != nil {
			return fmt.Errorf("begin transaction for migration %s: %w", version, err)
		}

		if _, err := tx.Exec(string(content)); err != nil {
			tx.Rollback()
			return fmt.Errorf("apply migration %s: %w", version, err)
		}

		if _, err := tx.Exec("INSERT INTO schema_migrations (version) VALUES ($1)", version); err != nil {
			tx.Rollback()
			return fmt.Errorf("record migration %s: %w", version, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit migration %s: %w", version, err)
		}

		slog.Info("applied migration", "version", version)
	}

	return nil
}
