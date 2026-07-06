package api

import (
	"context"
	"crypto/subtle"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/viny4/orbica/services/analytics/internal/db"
)

// AuthMiddleware protects the admin routes using a simple Bearer token check
// that matches the ADMIN_SECRET environment variable.
func AuthMiddleware(c *fiber.Ctx) error {
	secret := os.Getenv("ADMIN_SECRET")
	if secret == "" {
		// If no secret is configured, deny all access to be safe
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized: ADMIN_SECRET not set"})
	}

	authHeader := c.Get("Authorization")
	expectedHeader := "Bearer " + secret

	// Constant-time compare so the token can't be recovered via timing.
	if subtle.ConstantTimeCompare([]byte(authHeader), []byte(expectedHeader)) != 1 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	return c.Next()
}

// GetOverview returns high-level stats like total visitors, page views, etc.
func GetOverview(c *fiber.Ctx) error {
	ctx := context.Background()

	var visitors int
	err := db.Pool.QueryRow(ctx, "SELECT COUNT(DISTINCT session_id) FROM analytics_events").Scan(&visitors)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	var pageViews int
	err = db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM analytics_events WHERE event_type = 'page_view'").Scan(&pageViews)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	var onlineUsers int
	err = db.Pool.QueryRow(ctx, "SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE timestamp >= NOW() - INTERVAL '5 minutes'").Scan(&onlineUsers)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"visitors":   visitors,
		"page_views": pageViews,
		"online":     onlineUsers,
	})
}

// GetTraffic returns time series data for the line chart (page views by day)
func GetTraffic(c *fiber.Ctx) error {
	ctx := context.Background()
	query := `
		SELECT DATE_TRUNC('day', timestamp) AS date, COUNT(*) AS views
		FROM analytics_events
		WHERE event_type = 'page_view' AND timestamp >= NOW() - INTERVAL '30 days'
		GROUP BY date
		ORDER BY date ASC
	`
	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	type TrafficData struct {
		Date  string `json:"date"`
		Views int    `json:"views"`
	}
	var data []TrafficData

	for rows.Next() {
		var t TrafficData
		var d time.Time
		if err := rows.Scan(&d, &t.Views); err == nil {
			t.Date = d.Format("2006-01-02")
			data = append(data, t)
		}
	}
	return c.JSON(data)
}

// GetTopCountries returns top countries
func GetTopCountries(c *fiber.Ctx) error {
	ctx := context.Background()
	query := `
		SELECT COALESCE(country, 'Unknown'), COUNT(DISTINCT session_id) AS visitors
		FROM analytics_events
		GROUP BY 1
		ORDER BY visitors DESC
		LIMIT 10
	`
	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	type CountryData struct {
		Country  string `json:"country"`
		Visitors int    `json:"visitors"`
	}
	var data []CountryData

	for rows.Next() {
		var t CountryData
		if err := rows.Scan(&t.Country, &t.Visitors); err == nil {
			data = append(data, t)
		}
	}
	return c.JSON(data)
}

// GetBrowsers returns browser market share
func GetBrowsers(c *fiber.Ctx) error {
	ctx := context.Background()
	query := `
		SELECT COALESCE(browser, 'Unknown'), COUNT(DISTINCT session_id) AS visitors
		FROM analytics_events
		GROUP BY 1
		ORDER BY visitors DESC
		LIMIT 10
	`
	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	type BrowserData struct {
		Browser  string `json:"browser"`
		Visitors int    `json:"visitors"`
	}
	var data []BrowserData

	for rows.Next() {
		var t BrowserData
		if err := rows.Scan(&t.Browser, &t.Visitors); err == nil {
			data = append(data, t)
		}
	}
	return c.JSON(data)
}

// GetTopPages returns the most visited paths
func GetTopPages(c *fiber.Ctx) error {
	ctx := context.Background()
	query := `
		SELECT path, COUNT(*) AS views
		FROM analytics_events
		WHERE event_type = 'page_view' AND path IS NOT NULL
		GROUP BY path
		ORDER BY views DESC
		LIMIT 10
	`
	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	type PageData struct {
		Path  string `json:"path"`
		Views int    `json:"views"`
	}
	var data []PageData

	for rows.Next() {
		var t PageData
		if err := rows.Scan(&t.Path, &t.Views); err == nil {
			data = append(data, t)
		}
	}
	return c.JSON(data)
}

// GetDevices returns device market share
func GetDevices(c *fiber.Ctx) error {
	ctx := context.Background()
	query := `
		SELECT COALESCE(device, 'Unknown'), COUNT(DISTINCT session_id) AS visitors
		FROM analytics_events
		GROUP BY 1
		ORDER BY visitors DESC
		LIMIT 10
	`
	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	type DeviceData struct {
		Device   string `json:"device"`
		Visitors int    `json:"visitors"`
	}
	var data []DeviceData
	for rows.Next() {
		var t DeviceData
		if err := rows.Scan(&t.Device, &t.Visitors); err == nil {
			data = append(data, t)
		}
	}
	return c.JSON(data)
}

// GetEvents returns recent custom events
func GetEvents(c *fiber.Ctx) error {
	ctx := context.Background()
	query := `
		SELECT timestamp, event_type, path, payload
		FROM analytics_events
		WHERE event_type != 'page_view'
		ORDER BY timestamp DESC
		LIMIT 20
	`
	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	type EventData struct {
		Timestamp time.Time   `json:"timestamp"`
		EventType string      `json:"event_type"`
		Path      *string     `json:"path"`
		Payload   interface{} `json:"payload"`
	}
	var data []EventData
	for rows.Next() {
		var t EventData
		if err := rows.Scan(&t.Timestamp, &t.EventType, &t.Path, &t.Payload); err == nil {
			data = append(data, t)
		}
	}
	return c.JSON(data)
}

// GetTopSatellites returns the top viewed satellites
func GetTopSatellites(c *fiber.Ctx) error {
	ctx := context.Background()
	query := `
		SELECT path, COUNT(*) AS views
		FROM analytics_events
		WHERE event_type = 'satellite_view' OR path LIKE '/satellites/%'
		GROUP BY path
		ORDER BY views DESC
		LIMIT 10
	`
	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	type PageData struct {
		Path  string `json:"path"`
		Views int    `json:"views"`
	}
	var data []PageData
	for rows.Next() {
		var t PageData
		if err := rows.Scan(&t.Path, &t.Views); err == nil {
			data = append(data, t)
		}
	}
	return c.JSON(data)
}

// GetTopRockets returns the top viewed rockets
func GetTopRockets(c *fiber.Ctx) error {
	ctx := context.Background()
	query := `
		SELECT path, COUNT(*) AS views
		FROM analytics_events
		WHERE event_type = 'rocket_view' OR path LIKE '/rockets/%'
		GROUP BY path
		ORDER BY views DESC
		LIMIT 10
	`
	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	type PageData struct {
		Path  string `json:"path"`
		Views int    `json:"views"`
	}
	var data []PageData
	for rows.Next() {
		var t PageData
		if err := rows.Scan(&t.Path, &t.Views); err == nil {
			data = append(data, t)
		}
	}
	return c.JSON(data)
}

// GetTopSearches returns the top search terms
func GetTopSearches(c *fiber.Ctx) error {
	ctx := context.Background()
	query := `
		SELECT payload->>'query' AS search_term, COUNT(*) AS searches
		FROM analytics_events
		WHERE event_type = 'search' AND payload->>'query' IS NOT NULL
		GROUP BY search_term
		ORDER BY searches DESC
		LIMIT 10
	`
	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	defer rows.Close()

	type SearchData struct {
		SearchTerm string `json:"search_term"`
		Searches   int    `json:"searches"`
	}
	var data []SearchData
	for rows.Next() {
		var t SearchData
		if err := rows.Scan(&t.SearchTerm, &t.Searches); err == nil {
			data = append(data, t)
		}
	}
	return c.JSON(data)
}
