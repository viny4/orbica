package analytics

import (
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Register mounts the analytics ingest + admin routes on the API's Fiber app and
// starts the background writer. Call once at startup with the shared pool.
func Register(app *fiber.App, p *pgxpool.Pool) {
	initWorker(p, 10000)

	// Public ingest — the site tracker POSTs here. The API's global per-IP
	// limiter already protects it.
	app.Post("/track", trackEvent)

	// Admin read APIs, behind the bearer-token auth.
	admin := app.Group("/api/v1/admin", authMiddleware)
	admin.Get("/overview", getOverview)
	admin.Get("/traffic", getTraffic)
	admin.Get("/countries", getTopCountries)
	admin.Get("/cities", getTopCities)
	admin.Get("/locations", getLocations)
	admin.Get("/browsers", getBrowsers)
	admin.Get("/devices", getDevices)
	admin.Get("/events", getEvents)
	admin.Get("/top-pages", getTopPages)
	admin.Get("/top-satellites", getTopSatellites)
	admin.Get("/top-rockets", getTopRockets)
	admin.Get("/searches", getTopSearches)
}
