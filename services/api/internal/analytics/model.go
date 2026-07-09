// Package analytics is the first-party web-analytics feature folded into the
// main API: a POST /track ingest endpoint (buffered, batch-inserted) plus the
// /api/v1/admin/* read APIs the admin dashboard consumes. It shares the API's
// pgx pool and Fiber app, so it needs no separate service/deploy.
package analytics

import (
	"encoding/json"
	"time"
)

// Event is one tracked interaction, as posted by the site tracker and stored in
// the analytics_events table.
type Event struct {
	Timestamp       time.Time       `json:"timestamp"`
	AnonymousUserID string          `json:"anonymous_user_id"`
	SessionID       string          `json:"session_id"`
	EventType       string          `json:"event_type"`
	Payload         json.RawMessage `json:"payload,omitempty"`
	Path            string          `json:"path"`
	Referrer        string          `json:"referrer"`
	Browser         string          `json:"browser"`
	OS              string          `json:"os"`
	Device          string          `json:"device"`
	ScreenRes       string          `json:"screen_resolution"`
	TrackerVersion  string          `json:"tracker_version"`

	// Server-authoritative only. /track is public and unauthenticated, so these
	// must never be taken from the request body — otherwise anyone can inject a
	// fake location or clear the bot flag. All are derived from the request
	// (headers + IP geolocation) in trackEvent/enrichGeo.
	Country   string  `json:"-"`
	City      string  `json:"-"`
	Region    string  `json:"-"`
	Latitude  float64 `json:"-"`
	Longitude float64 `json:"-"`
	IsBot     bool    `json:"-"`
	CFRay     string  `json:"-"`
	IPHash    string  `json:"-"`

	// rawIP is the visitor IP captured server-side for geolocation only. It is
	// never JSON-(de)serialized and never stored — we persist ip_hash + geo.
	rawIP string
}
