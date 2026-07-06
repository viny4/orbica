package analytics

import (
	"crypto/sha256"
	"encoding/hex"
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

	// Server-side IP hash (never trust the body). Prefer Cloudflare's real-IP.
	ip := c.Get("CF-Connecting-IP")
	if ip == "" {
		ip = c.IP()
	}
	if ip != "" {
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
