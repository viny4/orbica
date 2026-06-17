// Orbica live satellite tracker — propagates TLEs and streams positions
// to subscribed WebSocket clients.
package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/orbica/tracker/internal/hub"
	"github.com/orbica/tracker/internal/ws"
)

func main() {
	dsn := env("POSTGRES_URL", "postgresql://rocketpedia:rocketpedia@localhost:5432/rocketpedia")
	port := env("TRACKER_PORT", "8081")

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()

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

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", ws.Handler(h))
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		dbErr := pool.Ping(r.Context())
		dbStatus := "ok"
		if dbErr != nil {
			dbStatus = dbErr.Error()
		}
		res := map[string]interface{}{
			"status":       "ok",
			"service":      "orbica-tracker",
			"catalog_size": h.CatalogSize(),
			"db_status":    dbStatus,
		}
		_ = json.NewEncoder(w).Encode(res)
	})

	addr := ":" + port
	log.Printf("orbica-tracker listening on %s (ws at /ws)", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
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

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
