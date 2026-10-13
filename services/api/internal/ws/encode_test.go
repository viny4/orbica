package ws

import (
	"encoding/json"
	"testing"

	"github.com/orbica/api/internal/propagate"
)

func TestEncodePositionsIsFlatRoundedJSON(t *testing.T) {
	got := encodePositions([]propagate.Position{
		{NoradID: 25544, Name: "ISS", Lat: 51.64161, Lng: -12.3456, AltitudeKM: 421.06, VelocityKMS: 7.6612},
		{NoradID: 20580, Lat: 0, Lng: 179.999, AltitudeKM: 535, VelocityKMS: 7.59},
	})
	want := `[25544,51.64,-12.35,421.1,7.66,20580,0.00,180.00,535.0,7.59]`
	if string(got) != want {
		t.Fatalf("got  %s\nwant %s", got, want)
	}
	// Must stay valid JSON for the browser decoder, and names never ship.
	var arr []float64
	if err := json.Unmarshal(got, &arr); err != nil || len(arr) != 10 {
		t.Fatalf("not a flat numeric array: %v", err)
	}
	if string(encodePositions(nil)) != "[]" {
		t.Fatal("empty input should encode as []")
	}
}

func TestApplyClampsTimeOffsetAndSubscriptions(t *testing.T) {
	c := &conn{subs: map[int]struct{}{}}
	c.apply(inbound{Action: "set_time", OffsetSeconds: 10 * 365 * 24 * 3600})
	if c.offset != maxOffset {
		t.Fatalf("offset not clamped: %v", c.offset)
	}
	c.apply(inbound{Action: "set_time", OffsetSeconds: -10 * 365 * 24 * 3600})
	if c.offset != -maxOffset {
		t.Fatalf("negative offset not clamped: %v", c.offset)
	}
	for i := 0; i < maxSubs+50; i++ {
		c.apply(inbound{Action: "subscribe", NoradID: i})
	}
	if len(c.subs) != maxSubs {
		t.Fatalf("subscriptions not capped: %d", len(c.subs))
	}
	c.apply(inbound{Action: "subscribe_all"})
	if len(c.subs) != 0 {
		t.Fatal("subscribe_all should reset to the whole sky")
	}
}
