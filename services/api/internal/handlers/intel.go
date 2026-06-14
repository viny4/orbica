package handlers

import "github.com/gofiber/fiber/v2"

// Conjunctions returns screened close approaches (closest first).
func (h *Handlers) Conjunctions(c *fiber.Ctx) error {
	return h.queryJSON(c, "[]", `
		SELECT json_agg(row_to_json(x) ORDER BY x.miss_km)
		FROM (
			SELECT cj.sat_a_name, cj.sat_b_name, cj.tca, cj.miss_km, cj.rel_speed_kms,
			       sa.slug AS sat_a_slug, sb.slug AS sat_b_slug
			FROM conjunctions cj
			LEFT JOIN satellites sa ON sa.id = cj.sat_a_id
			LEFT JOIN satellites sb ON sb.id = cj.sat_b_id
		) x`)
}

// Reentries returns objects decaying toward reentry (lowest perigee first).
func (h *Handlers) Reentries(c *fiber.Ctx) error {
	return h.queryJSON(c, "[]", `
		SELECT json_agg(row_to_json(x))
		FROM (
			SELECT re.name, re.perigee_km, re.apogee_km, re.status, re.est_days, s.slug
			FROM reentries re
			LEFT JOIN satellites s ON s.id = re.satellite_id
			ORDER BY re.perigee_km
			LIMIT 120
		) x`)
}

// SpaceWeather returns the latest geomagnetic/solar reading.
func (h *Handlers) SpaceWeather(c *fiber.Ctx) error {
	return h.queryObject(c, `
		SELECT row_to_json(x)
		FROM (
			SELECT kp, kp_state, solar_wind_kms, note, captured_at
			FROM space_weather ORDER BY captured_at DESC LIMIT 1
		) x`)
}

// SpaceEvents returns the derived event feed (storms, reentries, conjunctions…).
func (h *Handlers) SpaceEvents(c *fiber.Ctx) error {
	return h.queryJSON(c, "[]", `
		SELECT json_agg(row_to_json(x) ORDER BY x.occurred_at DESC)
		FROM (
			SELECT kind, title, detail, occurred_at, href
			FROM space_events ORDER BY occurred_at DESC LIMIT 30
		) x`)
}
