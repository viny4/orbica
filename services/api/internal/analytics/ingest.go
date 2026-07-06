package analytics

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// trackEvent accepts a page-view/interaction from the site tracker, enriches it
// with server-side fields (hashed IP, Cloudflare geo), queues it, and returns
// 200 immediately. It never blocks on the DB.
func trackEvent(c *fiber.Ctx) error {
	var e Event
	if err := c.BodyParser(&e); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
	}
	if e.EventType == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "event_type is required"})
	}

	// The UUID columns are NOT NULL — synthesize any the client omitted.
	if e.AnonymousUserID == "" {
		e.AnonymousUserID = uuid.New().String()
	}
	if e.SessionID == "" {
		e.SessionID = uuid.New().String()
	}
	if e.TrackerVersion == "" {
		e.TrackerVersion = "v1"
	}
	e.Timestamp = time.Now()

	// Resolve the real visitor IP (never trust the body). Prefer Cloudflare's
	// real-IP header, then the first hop of X-Forwarded-For (Render sets this),
	// then the socket IP.
	ip := c.Get("CF-Connecting-IP")
	if ip == "" {
		if xff := c.Get("X-Forwarded-For"); xff != "" {
			ip = strings.TrimSpace(strings.Split(xff, ",")[0])
		}
	}
	if ip == "" {
		ip = c.IP()
	}
	if ip != "" {
		e.rawIP = ip // transient — used for geo, never stored
		h := sha256.Sum256([]byte(ip))
		e.IPHash = hex.EncodeToString(h[:])
	}
	if country := c.Get("CF-IPCountry"); country != "" {
		e.Country = country
	}
	if ray := c.Get("CF-Ray"); ray != "" {
		e.CFRay = ray
	}

	select {
	case eventChannel <- &e:
		// queued
	default:
		// buffer full — drop rather than block the API
	}
	return c.SendStatus(fiber.StatusOK)
}
