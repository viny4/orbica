// Package httpx holds request plumbing shared by every handler: the real client
// IP behind proxies, request IDs, structured access logs and error responses
// that never leak internals.
package httpx

import (
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

// HeaderRequestID is echoed on every response and accepted from callers that
// already have one (so a trace can follow a request across services).
const HeaderRequestID = "X-Request-Id"

const localsRequestID = "request_id"

// ClientIP returns the visitor's address. The API sits behind Render's proxy
// (and Cloudflare), so c.IP() is the proxy — keying the rate limiter on it put
// every visitor in ONE shared bucket. Prefer Cloudflare's header, then the
// first X-Forwarded-For hop, then the socket address. Values that don't parse
// as an IP are ignored so junk headers can't mint unlimited buckets.
func ClientIP(c *fiber.Ctx) string {
	if ip := parseIP(c.Get("CF-Connecting-IP")); ip != "" {
		return ip
	}
	if xff := c.Get(fiber.HeaderXForwardedFor); xff != "" {
		if ip := parseIP(strings.Split(xff, ",")[0]); ip != "" {
			return ip
		}
	}
	return c.IP()
}

func parseIP(s string) string {
	ip := net.ParseIP(strings.TrimSpace(s))
	if ip == nil {
		return ""
	}
	return ip.String()
}

// RequestID assigns (or propagates) a request ID and exposes it to handlers.
func RequestID() fiber.Handler {
	return func(c *fiber.Ctx) error {
		id := c.Get(HeaderRequestID)
		if id == "" || len(id) > 64 {
			id = newID()
		}
		c.Locals(localsRequestID, id)
		c.Set(HeaderRequestID, id)
		return c.Next()
	}
}

// ID returns the current request's ID ("" outside a request).
func ID(c *fiber.Ctx) string {
	if v, ok := c.Locals(localsRequestID).(string); ok {
		return v
	}
	return ""
}

func newID() string {
	var b [8]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

// AccessLog writes one structured line per request (method, path, status,
// latency, request ID). Health checks are skipped — a keep-alive pinger hits
// them every few minutes and would drown the log.
func AccessLog(log *slog.Logger) fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		err := c.Next()
		path := c.Path()
		if strings.HasPrefix(path, "/health") {
			return err
		}
		status := c.Response().StatusCode()
		if err != nil {
			if fe, ok := err.(*fiber.Error); ok {
				status = fe.Code
			} else {
				status = fiber.StatusInternalServerError
			}
		}
		level := slog.LevelInfo
		if status >= 500 {
			level = slog.LevelError
		} else if status >= 400 {
			level = slog.LevelWarn
		}
		log.Log(c.UserContext(), level, "request",
			"method", c.Method(),
			"path", path,
			"status", status,
			"ms", float64(time.Since(start).Microseconds())/1000,
			"bytes", len(c.Response().Body()),
			"cache", string(c.Response().Header.Peek("X-Cache")),
			"request_id", ID(c),
		)
		return err
	}
}

// Fail writes a JSON error. For 5xx the client gets a generic message plus the
// request ID; the real cause (SQL errors, table names…) goes to the log only.
func Fail(c *fiber.Ctx, log *slog.Logger, status int, msg string, cause error) error {
	if status >= 500 {
		if cause != nil {
			log.Error("handler error", "path", c.Path(), "status", status, "err", cause.Error(), "request_id", ID(c))
		}
		return c.Status(status).JSON(fiber.Map{"error": "internal error", "request_id": ID(c)})
	}
	return c.Status(status).JSON(fiber.Map{"error": msg})
}
