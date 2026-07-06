package db

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var Pool *pgxpool.Pool

func ConnectDB() error {
	dsn := os.Getenv("POSTGRES_URL")
	if dsn == "" {
		return fmt.Errorf("POSTGRES_URL environment variable is not set")
	}

	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return err
	}

	// Optimize for Serverless Neon
	config.MaxConns = 10
	config.MinConns = 0 // Allow scaling to 0
	config.MaxConnIdleTime = 2 * time.Minute

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		return err
	}

	// Ping the DB
	if err := pool.Ping(context.Background()); err != nil {
		return err
	}

	log.Println("Connected to analytics database")
	Pool = pool
	return nil
}
