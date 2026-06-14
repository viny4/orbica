// Rocketpedia REST + GraphQL API server.
package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/compress"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	"github.com/rocketpedia/api/internal/config"
	"github.com/rocketpedia/api/internal/db"
	"github.com/rocketpedia/api/internal/handlers"
)

func main() {
	cfg := config.Load()

	ctx := context.Background()
	pool, err := db.New(ctx, cfg.PostgresURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()

	app := fiber.New(fiber.Config{
		AppName:      "rocketpedia-api",
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
	})
	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(compress.New())
	app.Use(cors.New())

	handlers.New(pool).Register(app)

	// Graceful shutdown on SIGINT/SIGTERM.
	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		<-sig
		log.Println("shutting down...")
		_ = app.ShutdownWithTimeout(10 * time.Second)
	}()

	addr := ":" + cfg.Port
	log.Printf("rocketpedia-api listening on %s", addr)
	if err := app.Listen(addr); err != nil {
		log.Fatalf("listen: %v", err)
	}
}
