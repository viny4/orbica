package analytics

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"sync"
	"time"
)

// geo is a resolved approximate location for an IP. Country is the 2-letter ISO
// code, to stay consistent with Cloudflare's CF-IPCountry header.
type geo struct {
	Country   string
	Region    string
	City      string
	Latitude  float64
	Longitude float64
}

// geoCache memoises IP -> location so we hit the external service at most once
// per unique visitor IP (repeat page views are free). Bounded implicitly by the
// number of distinct visitors; fine for this scale.
var (
	geoCache   = map[string]geo{}
	geoCacheMu sync.RWMutex
)

var geoClient = &http.Client{Timeout: 2 * time.Second}

// resolveGeo returns the cached/looked-up location for ip. Private, loopback and
// unparseable IPs return ok=false (nothing to geolocate). Network/service errors
// also return ok=false — geo is best-effort and must never block ingestion.
func resolveGeo(ip string) (geo, bool) {
	if ip == "" {
		return geo{}, false
	}
	parsed := net.ParseIP(ip)
	if parsed == nil || parsed.IsLoopback() || parsed.IsPrivate() || parsed.IsUnspecified() {
		return geo{}, false
	}

	geoCacheMu.RLock()
	g, ok := geoCache[ip]
	geoCacheMu.RUnlock()
	if ok {
		return g, g != geo{}
	}

	g, found := lookupGeo(ip)
	// Cache both hits and misses (misses as zero value) so we don't re-query a
	// dead/unroutable IP every batch.
	geoCacheMu.Lock()
	geoCache[ip] = g
	geoCacheMu.Unlock()
	return g, found
}

// lookupGeo calls the free, no-key ipwho.is HTTPS API.
func lookupGeo(ip string) (geo, bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://ipwho.is/"+ip, nil)
	if err != nil {
		return geo{}, false
	}
	resp, err := geoClient.Do(req)
	if err != nil {
		return geo{}, false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return geo{}, false
	}

	var body struct {
		Success     bool    `json:"success"`
		CountryCode string  `json:"country_code"`
		Region      string  `json:"region"`
		City        string  `json:"city"`
		Latitude    float64 `json:"latitude"`
		Longitude   float64 `json:"longitude"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil || !body.Success {
		return geo{}, false
	}
	return geo{
		Country:   body.CountryCode,
		Region:    body.Region,
		City:      body.City,
		Latitude:  body.Latitude,
		Longitude: body.Longitude,
	}, true
}
