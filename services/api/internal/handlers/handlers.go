// Package handlers implements the REST endpoints for the Rocketpedia API.
package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Handlers carries shared dependencies for all HTTP handlers.
type Handlers struct {
	DB *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Handlers {
	return &Handlers{DB: pool}
}

// Register wires every REST route under /api/v1.
func (h *Handlers) Register(app *fiber.App) {
	app.Get("/health", h.Health)

	v1 := app.Group("/api/v1")

	v1.Get("/timeline/years", h.TimelineYears)
	v1.Get("/timeline/years/:year", h.TimelineYear)

	v1.Get("/agencies", h.ListAgencies)
	v1.Get("/agencies/:id", h.GetAgency)

	v1.Get("/rockets", h.ListRockets)
	v1.Get("/rockets/:id", h.GetRocket)
	v1.Get("/rockets/:id/launches", h.RocketLaunches)
	v1.Get("/rockets/:id/payloads", h.RocketPayloads)
	v1.Get("/rockets/:id/articles", h.RocketArticles)

	v1.Get("/satellites", h.ListSatellites)
	v1.Get("/satellites/:id", h.GetSatellite)
	v1.Get("/satellites/:id/tle", h.SatelliteTLE)
	v1.Get("/satellites/:id/articles", h.SatelliteArticles)

	v1.Get("/articles/latest", h.LatestArticles)
	v1.Get("/track/meta", h.TrackMeta)

	v1.Get("/intel/conjunctions", h.Conjunctions)
	v1.Get("/intel/reentries", h.Reentries)
	v1.Get("/intel/spaceweather", h.SpaceWeather)
	v1.Get("/intel/events", h.SpaceEvents)

	v1.Get("/launches/upcoming", h.UpcomingLaunches)
	v1.Get("/launches/:id", h.GetLaunch)
	v1.Get("/on-this-day", h.OnThisDay)
	v1.Get("/constellations/:name", h.Constellation)
	v1.Get("/search", h.Search)
	v1.Get("/stats/leaderboard", h.Leaderboard)
	v1.Get("/stats/overview", h.StatsOverview)
}

// fail writes a JSON error with the given status.
func fail(c *fiber.Ctx, status int, msg string) error {
	return c.Status(status).JSON(fiber.Map{"error": msg})
}
