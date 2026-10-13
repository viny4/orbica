package handlers

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestUUIDPattern(t *testing.T) {
	ok := []string{"e5e80c02-90d8-4e6b-9c48-6066d0af9497", "E5E80C02-90D8-4E6B-9C48-6066D0AF9497"}
	bad := []string{"iss-zarya", "", "e5e80c02-90d8-4e6b-9c48-6066d0af949", "e5e80c02-90d8-4e6b-9c48-6066d0af9497x", "'; drop table x; --"}
	for _, s := range ok {
		if !uuidRe.MatchString(s) {
			t.Errorf("%q should match", s)
		}
	}
	for _, s := range bad {
		if uuidRe.MatchString(s) {
			t.Errorf("%q should not match", s)
		}
	}
}

// A non-UUID launch id must 404 without touching the database (DB is nil here,
// so reaching a query would panic). It used to 500 with Postgres' cast error.
func TestGetLaunchRejectsNonUUIDWithoutQuery(t *testing.T) {
	app := fiber.New()
	New(nil, nil).Register(app)
	resp, err := app.Test(httptest.NewRequest("GET", "/api/v1/launches/not-a-uuid", nil))
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("status = %d, want 404", resp.StatusCode)
	}
}

func TestOnThisDayValidatesDate(t *testing.T) {
	app := fiber.New()
	New(nil, nil).Register(app)
	for _, q := range []string{"", "?date=2024-01-01", "?date=1-1"} {
		resp, _ := app.Test(httptest.NewRequest("GET", "/api/v1/on-this-day"+q, nil))
		if resp.StatusCode != fiber.StatusBadRequest {
			t.Errorf("on-this-day%s status = %d, want 400", q, resp.StatusCode)
		}
	}
}

func TestSearchRequiresTwoChars(t *testing.T) {
	app := fiber.New()
	New(nil, nil).Register(app)
	resp, _ := app.Test(httptest.NewRequest("GET", "/api/v1/search?q=a", nil))
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}

func TestClampInt(t *testing.T) {
	if clampInt(5000, 1, 200) != 200 || clampInt(-3, 1, 200) != 1 || clampInt(50, 1, 200) != 50 {
		t.Fatal("clampInt bounds wrong")
	}
}
