package handlers

import (
	"context"
	"errors"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/orbica/api/internal/httpx"
)

const queryTimeout = 8 * time.Second

// slowQuery is the threshold above which a query's duration is logged — the
// cheap way to see which endpoints are getting slower as the data grows.
const slowQuery = 500 * time.Millisecond

// uuidPattern recognises a canonical UUID. Entity lookups match by slug OR id
// with `id = CASE WHEN $1 ~* uuidPattern THEN $1::uuid END` — index-friendly,
// unlike the old `id::text = $1`, which cast every primary key to text and
// forced a sequential scan (12 ms vs 0.02 ms on satellites).
const uuidPattern = `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`

// queryJSON runs a query whose first column of its single row is a JSON value
// (built server-side via json_agg / row_to_json) and writes it straight to the
// response. `emptyDefault` is sent when the query yields SQL NULL (e.g.
// json_agg over no rows) — typically "[]" for collections or "null" for objects.
func (h *Handlers) queryJSON(c *fiber.Ctx, emptyDefault string, sql string, args ...any) error {
	raw, err := h.scanJSON(c, sql, args...)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return h.dbFail(c, err)
	}
	c.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
	if len(raw) == 0 {
		return c.SendString(emptyDefault)
	}
	return c.Send(raw)
}

// queryObject is like queryJSON but 404s when the object is SQL NULL.
func (h *Handlers) queryObject(c *fiber.Ctx, sql string, args ...any) error {
	raw, err := h.scanJSON(c, sql, args...)
	// No row at all (SELECT … FROM (…) t over an empty match) means "doesn't
	// exist" — it used to surface as a 500 carrying pgx's error text.
	if errors.Is(err, pgx.ErrNoRows) {
		return fail(c, fiber.StatusNotFound, "not found")
	}
	if err != nil {
		return h.dbFail(c, err)
	}
	if len(raw) == 0 || string(raw) == "null" {
		return fail(c, fiber.StatusNotFound, "not found")
	}
	c.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
	return c.Send(raw)
}

func (h *Handlers) scanJSON(c *fiber.Ctx, sql string, args ...any) ([]byte, error) {
	ctx, cancel := context.WithTimeout(c.Context(), queryTimeout)
	defer cancel()
	start := time.Now()
	var raw []byte
	err := h.DB.QueryRow(ctx, sql, args...).Scan(&raw)
	if d := time.Since(start); d > slowQuery {
		h.Log.Warn("slow query", "path", c.Path(), "ms", d.Milliseconds(), "request_id", httpx.ID(c))
	}
	return raw, err
}

// dbFail maps database errors to responses: bad input is the caller's fault
// (400), a timeout is 503 (retryable), anything else is a logged 500 whose
// details never reach the client.
func (h *Handlers) dbFail(c *fiber.Ctx, err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "22P02" { // invalid_text_representation
		return fail(c, fiber.StatusBadRequest, "invalid parameter")
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return httpx.Fail(c, h.Log, fiber.StatusServiceUnavailable, "", err)
	}
	return httpx.Fail(c, h.Log, fiber.StatusInternalServerError, "", err)
}
