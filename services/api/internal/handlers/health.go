package handlers

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
)

// Health is a pure liveness probe: it deliberately does NOT touch Postgres.
// A keep-alive cron hits this every few minutes to stop Render's free dyno from
// sleeping; when it also pinged the DB, Neon could never auto-suspend and idled
// away ~90 CU-hrs/month (the entire free compute quota) serving heartbeats.
func (h *Handlers) Health(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"status":  "ok",
		"service": "orbica-api",
	})
}

// HealthDB is the deep check (liveness + DB reachability) for manual diagnosis.
// It wakes the database — never point automated pings at it.
func (h *Handlers) HealthDB(c *fiber.Ctx) error {
	ctx, cancel := context.WithTimeout(c.Context(), 2*time.Second)
	defer cancel()

	dbOK := true
	if err := h.DB.Ping(ctx); err != nil {
		dbOK = false
	}

	status := "ok"
	code := fiber.StatusOK
	if !dbOK {
		status = "degraded"
		code = fiber.StatusServiceUnavailable
	}
	return c.Status(code).JSON(fiber.Map{
		"status":   status,
		"database": dbOK,
		"service":  "orbica-api",
	})
}
