package handlers

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
)

const queryTimeout = 8 * time.Second

// queryJSON runs a query whose first column of its single row is a JSON value
// (built server-side via json_agg / row_to_json) and writes it straight to the
// response. Returns the raw bytes so callers can detect empty results.
//
// `emptyDefault` is sent when the query yields SQL NULL (e.g. json_agg over no
// rows) — typically "[]" for collections or "null" for single objects.
func (h *Handlers) queryJSON(c *fiber.Ctx, emptyDefault string, sql string, args ...any) error {
	ctx, cancel := context.WithTimeout(c.Context(), queryTimeout)
	defer cancel()

	var raw []byte
	err := h.DB.QueryRow(ctx, sql, args...).Scan(&raw)
	if err != nil {
		return fail(c, fiber.StatusInternalServerError, err.Error())
	}
	c.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
	if len(raw) == 0 {
		return c.SendString(emptyDefault)
	}
	return c.Send(raw)
}

// queryObject is like queryJSON but 404s when the object is SQL NULL.
func (h *Handlers) queryObject(c *fiber.Ctx, sql string, args ...any) error {
	ctx, cancel := context.WithTimeout(c.Context(), queryTimeout)
	defer cancel()

	var raw []byte
	err := h.DB.QueryRow(ctx, sql, args...).Scan(&raw)
	if err != nil {
		return fail(c, fiber.StatusInternalServerError, err.Error())
	}
	if len(raw) == 0 || string(raw) == "null" {
		return fail(c, fiber.StatusNotFound, "not found")
	}
	c.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
	return c.Send(raw)
}
