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
	Country         string          `json:"country"`
	City            string          `json:"city"`
	Region          string          `json:"region"`
	Browser         string          `json:"browser"`
	OS              string          `json:"os"`
	Device          string          `json:"device"`
	ScreenRes       string          `json:"screen_resolution"`
	IsBot           bool            `json:"is_bot"`
	CFRay           string          `json:"cf_ray"`
	IPHash          string          `json:"-"` // hashed from the request IP, never trusted from the body
	TrackerVersion  string          `json:"tracker_version"`
}
