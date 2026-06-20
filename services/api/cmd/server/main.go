// Orbica REST + GraphQL API server and WebSocket Tracker.
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
	"github.com/gofiber/contrib/websocket"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/orbica/api/internal/config"
	"github.com/orbica/api/internal/db"
	"github.com/orbica/api/internal/handlers"
	"github.com/orbica/api/internal/hub"
	"github.com/orbica/api/internal/ws"
)

func main() {
	cfg := config.Load()

	ctx := context.Background()
	pool, err := db.New(ctx, cfg.PostgresURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()

	// Initialize the WebSocket Hub for real-time satellite tracking
	h := hub.New(5 * time.Second)
	if err := loadCatalog(ctx, pool, h); err != nil {
		log.Printf("warning: could not load TLE catalog: %v", err)
	}
	log.Printf("loaded %d satellites into catalog", h.CatalogSize())

	stop := make(chan struct{})
	defer close(stop)
	go h.Run(stop)

	// Periodically refresh the catalog so newly-synced TLEs come online.
	go refreshLoop(ctx, pool, h, 30*time.Minute)

	// Setup Fiber REST API
	app := fiber.New(fiber.Config{
		AppName:      "orbica-api",
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
	})
	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(compress.New())
	app.Use(cors.New())

	// Register REST handlers
	handlers.New(pool).Register(app)

	// Register WebSocket handler for the live tracker
	app.Use("/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			c.Locals("allowed", true)
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})
	app.Get("/ws", ws.Handler(h))

	// Graceful shutdown on SIGINT/SIGTERM.
	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		<-sig
		log.Println("shutting down...")
		_ = app.ShutdownWithTimeout(10 * time.Second)
	}()

	addr := ":" + cfg.Port
	log.Printf("orbica-api listening on %s", addr)
	if err := app.Listen(addr); err != nil {
		log.Fatalf("listen: %v", err)
	}
}

// loadCatalog loads the newest TLE for every satellite that has one.
func loadCatalog(ctx context.Context, pool *pgxpool.Pool, h *hub.Hub) error {
	rows, err := pool.Query(ctx, `
		SELECT DISTINCT ON (s.norad_id)
		       s.norad_id, s.name, ts.tle_line1, ts.tle_line2
		FROM tle_snapshots ts
		JOIN satellites s ON s.id = ts.satellite_id
		WHERE s.norad_id IS NOT NULL
		ORDER BY s.norad_id, ts.captured_at DESC`)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var norad int
		var name, l1, l2 string
		if err := rows.Scan(&norad, &name, &l1, &l2); err != nil {
			return err
		}
		h.LoadTLE(norad, name, l1, l2)
	}
	return rows.Err()
}

func refreshLoop(ctx context.Context, pool *pgxpool.Pool, h *hub.Hub, every time.Duration) {
	t := time.NewTicker(every)
	defer t.Stop()
	for range t.C {
		if err := loadCatalog(ctx, pool, h); err != nil {
			log.Printf("catalog refresh failed: %v", err)
			continue
		}
		log.Printf("catalog refreshed: %d satellites", h.CatalogSize())
	}
}
