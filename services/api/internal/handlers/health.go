package handlers

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
)

// Health reports service liveness and DB reachability.
func (h *Handlers) Health(c *fiber.Ctx) error {
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
