package analytics

import (
	"context"
	"crypto/subtle"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
)

// authMiddleware guards the admin read APIs with a bearer token that must equal
// the ADMIN_SECRET env var (constant-time compare).
func authMiddleware(c *fiber.Ctx) error {
	secret := os.Getenv("ADMIN_SECRET")
	if secret == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized: ADMIN_SECRET not set"})
	}
	got := c.Get("Authorization")
	want := "Bearer " + secret
	if subtle.ConstantTimeCompare([]byte(got), []byte(want)) != 1 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	return c.Next()
}

func dbErr(c *fiber.Ctx, err error) error {
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
}

// getOverview returns high-level totals for the dashboard header.
func getOverview(c *fiber.Ctx) error {
	ctx := context.Background()
	var visitors, pageViews, online int
	if err := pool.QueryRow(ctx, "SELECT COUNT(DISTINCT session_id) FROM analytics_events").Scan(&visitors); err != nil {
		return dbErr(c, err)
	}
	if err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM analytics_events WHERE event_type = 'page_view'").Scan(&pageViews); err != nil {
		return dbErr(c, err)
	}
	if err := pool.QueryRow(ctx, "SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE timestamp >= NOW() - INTERVAL '5 minutes'").Scan(&online); err != nil {
		return dbErr(c, err)
	}

	// Real average session length: mean of (last - first event) per session, in
	// seconds. Single-event sessions count as 0 (bounces).
	var avgSession float64
	if err := pool.QueryRow(ctx, `
		SELECT COALESCE(AVG(dur), 0) FROM (
			SELECT EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) AS dur
			FROM analytics_events GROUP BY session_id
		) s`).Scan(&avgSession); err != nil {
		return dbErr(c, err)
	}

	return c.JSON(fiber.Map{
		"visitors":            visitors,
		"page_views":          pageViews,
		"online":              online,
		"avg_session_seconds": int(avgSession),
	})
}

// getTraffic returns daily page views for the last 30 days (line chart).
func getTraffic(c *fiber.Ctx) error {
	ctx := context.Background()
	rows, err := pool.Query(ctx, `
		SELECT DATE_TRUNC('day', timestamp) AS date, COUNT(*) AS views
		FROM analytics_events
		WHERE event_type = 'page_view' AND timestamp >= NOW() - INTERVAL '30 days'
		GROUP BY date ORDER BY date ASC`)
	if err != nil {
		return dbErr(c, err)
	}
	defer rows.Close()

	type point struct {
		Date  string `json:"date"`
		Views int    `json:"views"`
	}
	out := []point{}
	for rows.Next() {
		var d time.Time
		var p point
		if err := rows.Scan(&d, &p.Views); err == nil {
			p.Date = d.Format("2006-01-02")
			out = append(out, p)
		}
	}
	return c.JSON(out)
}

// countBy runs a "value + distinct-session count" aggregation and returns rows
// as {<label>: value, "visitors": n}. Used by countries/browsers/devices.
func countBy(c *fiber.Ctx, column, label string) error {
	ctx := context.Background()
	rows, err := pool.Query(ctx, `
		SELECT COALESCE(`+column+`, 'Unknown'), COUNT(DISTINCT session_id) AS visitors
		FROM analytics_events GROUP BY 1 ORDER BY visitors DESC LIMIT 10`)
	if err != nil {
		return dbErr(c, err)
	}
	defer rows.Close()

	out := []fiber.Map{}
	for rows.Next() {
		var v string
		var n int
		if err := rows.Scan(&v, &n); err == nil {
			out = append(out, fiber.Map{label: v, "visitors": n})
		}
	}
	return c.JSON(out)
}

func getTopCountries(c *fiber.Ctx) error { return countBy(c, "country", "country") }
func getBrowsers(c *fiber.Ctx) error     { return countBy(c, "browser", "browser") }
func getDevices(c *fiber.Ctx) error      { return countBy(c, "device", "device") }

// getTopCities returns the most-active cities (skips rows with no city).
func getTopCities(c *fiber.Ctx) error {
	ctx := context.Background()
	rows, err := pool.Query(ctx, `
		SELECT city, COALESCE(country, '') AS country, COUNT(DISTINCT session_id) AS visitors
		FROM analytics_events
		WHERE city IS NOT NULL AND city <> ''
		GROUP BY city, country ORDER BY visitors DESC LIMIT 15`)
	if err != nil {
		return dbErr(c, err)
	}
	defer rows.Close()

	out := []fiber.Map{}
	for rows.Next() {
		var city, country string
		var n int
		if err := rows.Scan(&city, &country, &n); err == nil {
			out = append(out, fiber.Map{"city": city, "country": country, "visitors": n})
		}
	}
	return c.JSON(out)
}

// getLocations returns geolocated points for a map — one row per distinct
// coordinate with a visitor count (capped).
func getLocations(c *fiber.Ctx) error {
	ctx := context.Background()
	rows, err := pool.Query(ctx, `
		SELECT latitude, longitude,
		       COALESCE(city, '') AS city, COALESCE(country, '') AS country,
		       COUNT(DISTINCT session_id) AS visitors
		FROM analytics_events
		WHERE latitude IS NOT NULL AND longitude IS NOT NULL
		GROUP BY latitude, longitude, city, country
		ORDER BY visitors DESC LIMIT 500`)
	if err != nil {
		return dbErr(c, err)
	}
	defer rows.Close()

	out := []fiber.Map{}
	for rows.Next() {
		var lat, lon float64
		var city, country string
		var n int
		if err := rows.Scan(&lat, &lon, &city, &country, &n); err == nil {
			out = append(out, fiber.Map{
				"latitude": lat, "longitude": lon,
				"city": city, "country": country, "visitors": n,
			})
		}
	}
	return c.JSON(out)
}

// topPaths returns the most-viewed paths, optionally filtered by a LIKE prefix.
func topPaths(c *fiber.Ctx, where string) error {
	ctx := context.Background()
	rows, err := pool.Query(ctx, `
		SELECT path, COUNT(*) AS views FROM analytics_events
		WHERE `+where+` AND path IS NOT NULL
		GROUP BY path ORDER BY views DESC LIMIT 10`)
	if err != nil {
		return dbErr(c, err)
	}
	defer rows.Close()

	out := []fiber.Map{}
	for rows.Next() {
		var p string
		var n int
		if err := rows.Scan(&p, &n); err == nil {
			out = append(out, fiber.Map{"path": p, "views": n})
		}
	}
	return c.JSON(out)
}

func getTopPages(c *fiber.Ctx) error {
	return topPaths(c, "event_type = 'page_view'")
}
func getTopSatellites(c *fiber.Ctx) error {
	return topPaths(c, "(event_type = 'satellite_view' OR path LIKE '/satellites/%')")
}
func getTopRockets(c *fiber.Ctx) error {
	return topPaths(c, "(event_type = 'rocket_view' OR path LIKE '/rockets/%')")
}

// getEvents returns recent non-pageview custom events.
func getEvents(c *fiber.Ctx) error {
	ctx := context.Background()
	rows, err := pool.Query(ctx, `
		SELECT timestamp, event_type, path, payload FROM analytics_events
		WHERE event_type != 'page_view' ORDER BY timestamp DESC LIMIT 20`)
	if err != nil {
		return dbErr(c, err)
	}
	defer rows.Close()

	out := []fiber.Map{}
	for rows.Next() {
		var ts time.Time
		var et string
		var path *string
		var payload any
		if err := rows.Scan(&ts, &et, &path, &payload); err == nil {
			out = append(out, fiber.Map{"timestamp": ts, "event_type": et, "path": path, "payload": payload})
		}
	}
	return c.JSON(out)
}

// getTopSearches returns the most frequent search terms.
func getTopSearches(c *fiber.Ctx) error {
	ctx := context.Background()
	rows, err := pool.Query(ctx, `
		SELECT payload->>'query' AS term, COUNT(*) AS searches FROM analytics_events
		WHERE event_type = 'search' AND payload->>'query' IS NOT NULL
		GROUP BY term ORDER BY searches DESC LIMIT 10`)
	if err != nil {
		return dbErr(c, err)
	}
	defer rows.Close()

	out := []fiber.Map{}
	for rows.Next() {
		var term string
		var n int
		if err := rows.Scan(&term, &n); err == nil {
			out = append(out, fiber.Map{"search_term": term, "searches": n})
		}
	}
	return c.JSON(out)
}
