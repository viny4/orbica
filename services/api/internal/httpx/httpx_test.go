package httpx

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func ipApp() *fiber.App {
	app := fiber.New()
	app.Get("/", func(c *fiber.Ctx) error { return c.SendString(ClientIP(c)) })
	return app
}

func get(t *testing.T, app *fiber.App, headers map[string]string) (string, *httpResp) {
	t.Helper()
	req := httptest.NewRequest("GET", "/", nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := io.ReadAll(resp.Body)
	return string(b), &httpResp{status: resp.StatusCode, header: resp.Header.Get}
}

type httpResp struct {
	status int
	header func(string) string
}

func TestClientIPPrefersCloudflareThenFirstForwardedHop(t *testing.T) {
	app := ipApp()
	cases := []struct {
		name    string
		headers map[string]string
		want    string
	}{
		{"cloudflare wins", map[string]string{"CF-Connecting-IP": "203.0.113.7", "X-Forwarded-For": "198.51.100.1"}, "203.0.113.7"},
		{"first xff hop", map[string]string{"X-Forwarded-For": "198.51.100.1, 10.0.0.1"}, "198.51.100.1"},
		{"junk cf header ignored", map[string]string{"CF-Connecting-IP": "not-an-ip", "X-Forwarded-For": "198.51.100.9"}, "198.51.100.9"},
		{"ipv6 normalised", map[string]string{"CF-Connecting-IP": "2001:DB8::1"}, "2001:db8::1"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got, _ := get(t, app, tc.headers); got != tc.want {
				t.Fatalf("ClientIP = %q, want %q", got, tc.want)
			}
		})
	}
	// No proxy headers at all: falls back to the socket address (never empty).
	if got, _ := get(t, app, nil); got == "" {
		t.Fatal("ClientIP fell back to empty string")
	}
}

func TestRequestIDGeneratedAndPropagated(t *testing.T) {
	app := fiber.New()
	app.Use(RequestID())
	app.Get("/", func(c *fiber.Ctx) error { return c.SendString(ID(c)) })

	body, r := get(t, app, nil)
	if len(body) != 16 || r.header(HeaderRequestID) != body {
		t.Fatalf("generated id %q / header %q", body, r.header(HeaderRequestID))
	}
	body, r = get(t, app, map[string]string{HeaderRequestID: "upstream-123"})
	if body != "upstream-123" || r.header(HeaderRequestID) != "upstream-123" {
		t.Fatalf("propagated id %q / header %q", body, r.header(HeaderRequestID))
	}
	// Absurdly long inbound ids are replaced, not echoed.
	body, _ = get(t, app, map[string]string{HeaderRequestID: strings.Repeat("x", 200)})
	if len(body) != 16 {
		t.Fatalf("long id should be replaced, got %d chars", len(body))
	}
}

func TestFailNeverLeaksInternalErrors(t *testing.T) {
	var logged strings.Builder
	log := slog.New(slog.NewTextHandler(&logged, nil))
	app := fiber.New()
	app.Use(RequestID())
	app.Get("/", func(c *fiber.Ctx) error {
		return Fail(c, log, fiber.StatusInternalServerError, "", errors.New(`relation "secret_table" does not exist`))
	})

	body, r := get(t, app, nil)
	if r.status != 500 {
		t.Fatalf("status %d", r.status)
	}
	if strings.Contains(body, "secret_table") {
		t.Fatalf("internal error leaked to client: %s", body)
	}
	var out map[string]string
	_ = json.Unmarshal([]byte(body), &out)
	if out["error"] != "internal error" || out["request_id"] == "" {
		t.Fatalf("unexpected body %s", body)
	}
	if !strings.Contains(logged.String(), "secret_table") {
		t.Fatal("the real cause should be logged server-side")
	}
}
