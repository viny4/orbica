package api

import (
	"crypto/sha256"
	"encoding/hex"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/google/uuid"
	"github.com/viny4/orbica/services/analytics/internal/models"
	"github.com/viny4/orbica/services/analytics/internal/worker"
)

func TrackEvent(c *fiber.Ctx) error {
	var event models.AnalyticsEvent

	if err := c.BodyParser(&event); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON"})
	}

	// Basic Request Validation
	if event.EventType == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "event_type is required"})
	}
	if event.AnonymousUserID == "" {
		event.AnonymousUserID = uuid.New().String()
	}
	if event.SessionID == "" {
		event.SessionID = uuid.New().String()
	}
	if event.TrackerVersion == "" {
		event.TrackerVersion = "v1"
	}

	event.Timestamp = time.Now()

	// Cloudflare Headers Integration
	cfIP := c.Get("CF-Connecting-IP")
	if cfIP == "" {
		cfIP = c.IP()
	}
	if cfIP != "" {
		hash := sha256.Sum256([]byte(cfIP))
		event.IPHash = hex.EncodeToString(hash[:])
	}
	
	if country := c.Get("CF-IPCountry"); country != "" {
		event.Country = country
	}
	if ray := c.Get("CF-Ray"); ray != "" {
		event.CFRay = ray
	}
	
	// Send to Go Channel Queue
	select {
	case worker.EventChannel <- &event:
		// Queued successfully
	default:
		// Queue is full, drop event to prevent blocking the API
		// In a production system, you might want to log this to a file or a dead-letter queue.
	}

	// Always return 200 immediately
	return c.SendStatus(fiber.StatusOK)
}

func SetupRoutes(app *fiber.App) {
	// Public ingest endpoint — rate-limit per IP so it can't be flooded to run up
	// DB writes / hosting cost. Generous for real browsers (many events/session).
	app.Post("/track", limiter.New(limiter.Config{
		Max:        120,
		Expiration: time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			if ip := c.Get("CF-Connecting-IP"); ip != "" {
				return ip
			}
			return c.IP()
		},
	}), TrackEvent)

	// Admin API V1
	v1Admin := app.Group("/api/v1/admin", AuthMiddleware)
	v1Admin.Get("/overview", GetOverview)
	v1Admin.Get("/traffic", GetTraffic)
	v1Admin.Get("/countries", GetTopCountries)
	v1Admin.Get("/browsers", GetBrowsers)
	v1Admin.Get("/devices", GetDevices)
	v1Admin.Get("/events", GetEvents)
	v1Admin.Get("/top-pages", GetTopPages)
	v1Admin.Get("/top-satellites", GetTopSatellites)
	v1Admin.Get("/top-rockets", GetTopRockets)
	v1Admin.Get("/searches", GetTopSearches)
}
