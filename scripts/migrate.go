// migrate.go — apply ordered SQL schema files to Postgres.
//
// Usage:
//   go run scripts/migrate.go up     # apply all data/schemas/*.sql in order
//   go run scripts/migrate.go status # list applied migrations
//
// Reads POSTGRES_URL from the environment (or .env). Each schema file is
// applied in a transaction and recorded in schema_migrations so re-runs skip
// already-applied files.
package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
)

const schemaDir = "data/schemas"

func main() {
	cmd := "up"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}

	dsn := os.Getenv("POSTGRES_URL")
	if dsn == "" {
		dsn = "postgresql://rocketpedia:rocketpedia@localhost:5432/rocketpedia"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		fatal("connect: %v", err)
	}
	defer conn.Close(ctx)

	if _, err := conn.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			filename TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ DEFAULT NOW()
		)`); err != nil {
		fatal("ensure schema_migrations: %v", err)
	}

	files, err := filepath.Glob(filepath.Join(schemaDir, "*.sql"))
	if err != nil {
		fatal("glob: %v", err)
	}
	sort.Strings(files)

	switch cmd {
	case "status":
		for _, f := range files {
			name := filepath.Base(f)
			var applied bool
			_ = conn.QueryRow(ctx,
				`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE filename=$1)`, name).Scan(&applied)
			mark := "pending"
			if applied {
				mark = "applied"
			}
			fmt.Printf("  [%s] %s\n", mark, name)
		}
	case "up":
		for _, f := range files {
			name := filepath.Base(f)
			var applied bool
			_ = conn.QueryRow(ctx,
				`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE filename=$1)`, name).Scan(&applied)
			if applied {
				fmt.Printf("  skip   %s\n", name)
				continue
			}
			sql, err := os.ReadFile(f)
			if err != nil {
				fatal("read %s: %v", name, err)
			}
			tx, err := conn.Begin(ctx)
			if err != nil {
				fatal("begin: %v", err)
			}
			if _, err := tx.Exec(ctx, string(sql)); err != nil {
				_ = tx.Rollback(ctx)
				fatal("apply %s: %v", name, err)
			}
			if _, err := tx.Exec(ctx,
				`INSERT INTO schema_migrations(filename) VALUES($1)`, name); err != nil {
				_ = tx.Rollback(ctx)
				fatal("record %s: %v", name, err)
			}
			if err := tx.Commit(ctx); err != nil {
				fatal("commit %s: %v", name, err)
			}
			fmt.Printf("  apply  %s\n", name)
		}
		fmt.Println("migrations up to date")
	default:
		fatal("unknown command %q (use: up | status)", cmd)
	}
}

func fatal(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "migrate: "+format+"\n", args...)
	os.Exit(1)
}
