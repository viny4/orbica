// Orbica REST + GraphQL API server and WebSocket Tracker.
package main

import (
	"context"
	"log"
	"log/slog"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cache"
	"github.com/gofiber/fiber/v2/middleware/compress"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	recovermw "github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"github.com/orbica/api/internal/analytics"
	"github.com/orbica/api/internal/config"
	"github.com/orbica/api/internal/db"
	"github.com/orbica/api/internal/handlers"
	"github.com/orbica/api/internal/httpx"
	"github.com/orbica/api/internal/hub"
	"github.com/orbica/api/internal/ws"
)

func main() {
	_ = godotenv.Load("../../.env") // Load from root if running locally
	cfg := config.Load()

	// One JSON line per event: greppable on the host's log viewer and parseable
	// by any log pipeline later.
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	ctx := context.Background()
	pool, err := db.New(ctx, cfg.PostgresURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()

	// Initialize the WebSocket Hub for real-time satellite tracking
	// 10s cadence: the globe interpolates between frames, so a slower tick is
	// visually identical while halving egress on a bandwidth-metered host.
	h := hub.New(10*time.Second, ws.Encode)
	if err := loadCatalog(ctx, pool, h); err != nil {
		log.Printf("warning: could not load TLE catalog: %v", err)
	}
	log.Printf("loaded %d satellites into catalog", h.CatalogSize())

	stop := make(chan struct{})
	defer close(stop)
	go h.Run(stop)

	// Periodically refresh the catalog so newly-synced TLEs come online. New TLEs
	// only arrive via the 6-hourly sync, so refreshing faster than that just
	// wakes the auto-suspending database for nothing.
	go refreshLoop(ctx, pool, h, 6*time.Hour)

	// Setup Fiber REST API
	app := fiber.New(fiber.Config{
		AppName:      "orbica-api",
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
	})
	app.Use(recovermw.New())
	app.Use(httpx.RequestID())
	app.Use(httpx.AccessLog(logger))
	app.Use(compress.New())
	app.Use(cors.New())

	// Per-IP rate limit so scrapers/bots can't hammer the DB and run up hosting
	// costs. Generous for real users; the live-tracker WS and health check are
	// exempt. Tune with RATE_LIMIT_PER_MIN (default 120 req/min/IP).
	app.Use(limiter.New(limiter.Config{
		Max:        envInt("RATE_LIMIT_PER_MIN", 120),
		Expiration: time.Minute,
		// The real visitor, not Render's proxy: keyed on c.IP() every visitor
		// shared one 120 req/min bucket.
		KeyGenerator: httpx.ClientIP,
		Next: func(c *fiber.Ctx) bool {
			p := c.Path()
			return p == "/health" || strings.HasPrefix(p, "/ws")
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).
				JSON(fiber.Map{"error": "rate limit exceeded — slow down"})
		},
	}))

	// Cache heavy GET responses (lists, stats, timeline, detail pages) so repeat
	// traffic is served from an in-process store instead of re-querying Postgres
	// — faster and far cheaper on a small dyno. Live/admin/search endpoints are
	// skipped, and data is at most ~5 min stale (well inside the 6h sync cadence).
	// (In-memory keeps the build dependency-free; a single dyno gets the full
	// benefit. Swap in a shared store here if the API is ever scaled out.)
	app.Use(cache.New(cacheConfig()))

	// Register REST handlers
	handlers.New(pool, logger).Register(app)

	// First-party analytics: POST /track ingest + /api/v1/admin/* read APIs.
	analytics.Register(app, pool)

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

// envInt reads an integer environment variable, falling back to def.
func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return def
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

// cacheConfig is the response cache for heavy GET endpoints (lists, stats,
// timeline, detail pages): repeat traffic is served from memory instead of
// re-querying Postgres. Live/admin/search endpoints are skipped, and only
// successful responses are ever stored.
func cacheConfig() cache.Config {
	return cache.Config{
		Expiration:   5 * time.Minute,
		CacheControl: true,
		MaxBytes:     64 << 20, // bounded: evicts oldest entries past 64 MB
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.Path() + "?" + string(c.Request().URI().QueryString())
		},
		Next: func(c *fiber.Ctx) bool {
			if c.Method() != fiber.MethodGet {
				return true // never cache writes
			}
			// Next also runs after the handler, before storing: only cache
			// successes, or a DB blip is served to everyone for five minutes.
			if s := c.Response().StatusCode(); s < 200 || s >= 300 {
				return true
			}
			p := c.Path()
			// Skip live (tracker), admin (sync-logs), and high-cardinality (search).
			return strings.HasPrefix(p, "/health") || // incl. /health/db — diagnostics must not be stale
				strings.HasPrefix(p, "/ws") ||
				strings.HasPrefix(p, "/api/v1/track") ||
				strings.HasPrefix(p, "/api/v1/admin") || // live analytics — never cache
				strings.HasPrefix(p, "/api/v1/sync-logs") ||
				strings.HasPrefix(p, "/api/v1/search")
		},
	}
}
