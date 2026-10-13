package main

import (
	"io"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cache"
)

// The response cache must never store an error: Fiber's cache stores any status
// by default, so one DB blip used to be served as a 500 to everyone for 5 min.
func TestCacheStoresSuccessesOnly(t *testing.T) {
	app := fiber.New()
	app.Use(cache.New(cacheConfig()))
	calls := 0
	fail := true
	app.Get("/api/v1/rockets", func(c *fiber.Ctx) error {
		calls++
		if fail {
			return c.Status(500).SendString("boom")
		}
		return c.SendString("ok")
	})

	do := func() (int, string) {
		resp, err := app.Test(httptest.NewRequest("GET", "/api/v1/rockets", nil))
		if err != nil {
			t.Fatal(err)
		}
		b, _ := io.ReadAll(resp.Body)
		return resp.StatusCode, string(b)
	}

	if s, _ := do(); s != 500 {
		t.Fatalf("first call status %d", s)
	}
	fail = false
	if s, b := do(); s != 200 || b != "ok" {
		t.Fatalf("error response was cached: %d %q", s, b)
	}
	// The success is cached: a third call doesn't reach the handler.
	do()
	if calls != 2 {
		t.Fatalf("handler calls = %d, want 2 (success served from cache)", calls)
	}
}

func TestCacheSkipsLiveAndAdminPaths(t *testing.T) {
	app := fiber.New()
	app.Use(cache.New(cacheConfig()))
	n := 0
	for _, p := range []string{"/api/v1/search", "/api/v1/sync-logs", "/api/v1/track/meta", "/health"} {
		app.Get(p, func(c *fiber.Ctx) error { n++; return c.SendString("x") })
	}
	for _, p := range []string{"/api/v1/search", "/api/v1/sync-logs", "/api/v1/track/meta", "/health"} {
		for i := 0; i < 2; i++ {
			_, _ = app.Test(httptest.NewRequest("GET", p, nil))
		}
	}
	if n != 8 {
		t.Fatalf("uncacheable paths were cached: %d handler calls, want 8", n)
	}
}
