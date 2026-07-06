package models

import (
	"encoding/json"
	"time"
)

type AnalyticsEvent struct {
	ID              int64           `json:"-"`
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
	IPHash          string          `json:"-"` // We hash IP in the handler before assigning it here
	TrackerVersion  string          `json:"tracker_version"`
}
