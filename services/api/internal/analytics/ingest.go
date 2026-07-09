package analytics

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// isISOCountry reports whether s is exactly two uppercase A-Z letters. Rejects
// Cloudflare's placeholders ("XX", "T1") and any injected junk.
func isISOCountry(s string) bool {
	if len(s) != 2 {
		return false
	}
	for i := 0; i < 2; i++ {
		if s[i] < 'A' || s[i] > 'Z' {
			return false
		}
	}
	return s != "XX" && s != "T1"
}

// botUATokens are substrings that mark an automated client. Matched
// case-insensitively against the User-Agent.
var botUATokens = []string{
	"bot", "crawler", "spider", "crawl", "slurp", "headless",
	"python-requests", "curl/", "wget", "go-http-client", "java/",
	"axios", "node-fetch", "okhttp", "phantomjs", "puppeteer", "playwright",
	"lighthouse", "pingdom", "uptimerobot", "monitor", "preview",
}

// isBotUA flags automated traffic so it can be excluded from visitor counts.
// An empty User-Agent is treated as a bot (real browsers always send one).
func isBotUA(ua string) bool {
	if ua == "" {
		return true
	}
	lower := strings.ToLower(ua)
	for _, tok := range botUATokens {
		if strings.Contains(lower, tok) {
			return true
		}
	}
	return false
}

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
	// Only trust a well-formed ISO code; Cloudflare also emits placeholders like
	// "XX"/"T1", and we never want junk in the country column.
	if cc := c.Get("CF-IPCountry"); isISOCountry(cc) {
		e.Country = cc
	}
	e.CFRay = c.Get("CF-Ray")
	e.IsBot = isBotUA(c.Get("User-Agent"))

	select {
	case eventChannel <- &e:
		// queued
	default:
		// buffer full — drop rather than block the API
	}
	return c.SendStatus(fiber.StatusOK)
}
