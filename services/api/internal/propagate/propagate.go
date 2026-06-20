// Package propagate turns a TLE into a live geodetic position using SGP4.
package propagate

import (
	"math"
	"time"

	satellite "github.com/joshuaferrara/go-satellite"
)

// Position is a satellite's instantaneous geodetic state.
type Position struct {
	NoradID     int     `json:"norad_id"`
	Name        string  `json:"name"`
	Lat         float64 `json:"lat"`
	Lng         float64 `json:"lng"`
	AltitudeKM  float64 `json:"altitude_km"`
	VelocityKMS float64 `json:"velocity_km_s"`
}

// Propagator holds a parsed TLE and propagates it to any instant.
type Propagator struct {
	NoradID int
	Name    string
	sat     satellite.Satellite
}

// New parses a TLE pair into a reusable propagator.
func New(noradID int, name, line1, line2 string) Propagator {
	sat := satellite.TLEToSat(line1, line2, satellite.GravityWGS84)
	return Propagator{NoradID: noradID, Name: name, sat: sat}
}

// At computes the geodetic position at time t (UTC).
func (p Propagator) At(t time.Time) Position {
	t = t.UTC()
	pos, vel := satellite.Propagate(
		p.sat,
		t.Year(), int(t.Month()), t.Day(),
		t.Hour(), t.Minute(), t.Second(),
	)

	gmst := satellite.GSTimeFromDate(
		t.Year(), int(t.Month()), t.Day(),
		t.Hour(), t.Minute(), t.Second(),
	)
	altitude, _, latlng := satellite.ECIToLLA(pos, gmst)

	// Speed is the magnitude of the ECI velocity vector (km/s).
	speed := math.Sqrt(vel.X*vel.X + vel.Y*vel.Y + vel.Z*vel.Z)

	// Round to keep the broadcast payload small — 2dp of lat/lng is ~1 km,
	// plenty for a globe of dots, and it shrinks the JSON dramatically.
	return Position{
		NoradID:     p.NoradID,
		Name:        p.Name,
		Lat:         round(latlng.Latitude*180.0/math.Pi, 2),
		Lng:         round(normalizeLng(latlng.Longitude*180.0/math.Pi), 2),
		AltitudeKM:  round(altitude, 1),
		VelocityKMS: round(speed, 2),
	}
}

func round(v float64, dp int) float64 {
	m := math.Pow(10, float64(dp))
	return math.Round(v*m) / m
}

// normalizeLng maps longitude into [-180, 180].
func normalizeLng(lng float64) float64 {
	for lng > 180 {
		lng -= 360
	}
	for lng < -180 {
		lng += 360
	}
	return lng
}
