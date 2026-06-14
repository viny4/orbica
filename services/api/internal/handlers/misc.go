package handlers

import (
	"github.com/gofiber/fiber/v2"
)

// GetLaunch returns a single launch with rocket, agency and site joined.
func (h *Handlers) GetLaunch(c *fiber.Ctx) error {
	id := c.Params("id")
	return h.queryObject(c, `
		SELECT row_to_json(t)
		FROM (
			SELECT le.*,
			       row_to_json(rv) AS rocket,
			       row_to_json(a)  AS agency,
			       row_to_json(ls) AS launch_site,
			       COALESCE((
			         SELECT json_agg(json_build_object('id', s.id, 'slug', s.slug, 'name', s.name,
			           'norad_id', s.norad_id, 'purpose', s.purpose, 'constellation', s.constellation,
			           'orbit_type', s.orbit_type) ORDER BY s.name)
			         FROM satellites s WHERE s.launch_event_id = le.id
			       ), '[]') AS payloads
			FROM launch_events le
			LEFT JOIN rocket_vehicles rv ON rv.id = le.rocket_id
			LEFT JOIN agencies a ON a.id = le.agency_id
			LEFT JOIN launch_sites ls ON ls.id = le.launch_site_id
			WHERE le.id = $1
		) t`, id)
}

// UpcomingLaunches returns the next scheduled launches (for countdowns).
func (h *Handlers) UpcomingLaunches(c *fiber.Ctx) error {
	limit := clampInt(c.QueryInt("limit", 24), 1, 100)
	return h.queryJSON(c, "[]", `
		SELECT json_agg(row_to_json(l))
		FROM (
			SELECT le.id, le.name, le.mission_name, le.mission_description, le.launch_time,
			       le.outcome, le.mission_type,
			       rv.slug AS rocket_slug, rv.name AS rocket_name,
			       a.slug AS agency_slug, a.name AS agency_name,
			       ls.name AS site_name
			FROM launch_events le
			LEFT JOIN rocket_vehicles rv ON rv.id = le.rocket_id
			LEFT JOIN agencies a ON a.id = le.agency_id
			LEFT JOIN launch_sites ls ON ls.id = le.launch_site_id
			WHERE le.launch_time > NOW()
			ORDER BY le.launch_time ASC
			LIMIT $1
		) l`, limit)
}

// OnThisDay returns launches across all years matching ?date=MM-DD.
func (h *Handlers) OnThisDay(c *fiber.Ctx) error {
	date := c.Query("date") // expected MM-DD
	if len(date) != 5 || date[2] != '-' {
		return fail(c, fiber.StatusBadRequest, "date must be MM-DD")
	}
	return h.queryJSON(c, "[]", `
		SELECT json_agg(row_to_json(l) ORDER BY l.launch_time DESC)
		FROM (
			SELECT le.id, le.name, le.mission_name, le.launch_time, le.launch_year,
			       le.outcome, rv.name AS rocket_name, a.name AS agency_name
			FROM launch_events le
			LEFT JOIN rocket_vehicles rv ON rv.id = le.rocket_id
			LEFT JOIN agencies a ON a.id = le.agency_id
			WHERE to_char(le.launch_time, 'MM-DD') = $1
		) l`, date)
}

// Constellation returns all satellites in a named constellation (e.g. Starlink).
func (h *Handlers) Constellation(c *fiber.Ctx) error {
	name := c.Params("name")
	return h.queryJSON(c, "[]", `
		SELECT json_agg(row_to_json(s) ORDER BY s.launch_date)
		FROM (
			SELECT id, name, norad_id, orbit_type, status, launch_date,
			       altitude_periapsis_km, altitude_apoapsis_km, inclination_deg
			FROM satellites
			WHERE constellation ILIKE $1
		) s`, name)
}

// Search runs a simple cross-entity ILIKE search. Phase 2 swaps this for
// Elasticsearch; the route contract stays the same.
func (h *Handlers) Search(c *fiber.Ctx) error {
	q := c.Query("q")
	if len(q) < 2 {
		return fail(c, fiber.StatusBadRequest, "q must be at least 2 chars")
	}
	// Match names first, but also descriptions/COSPAR so nicknames (e.g.
	// "Mangalyaan" → Mars Orbiter Mission) and designators resolve. Exact-name
	// hits rank above description hits.
	return h.queryJSON(c, "[]", `
		SELECT json_agg(json_build_object('kind', kind, 'slug', slug, 'name', name))
		FROM (
			SELECT kind, slug, name, rank FROM (
				SELECT 'rocket' AS kind, slug, name, 0 AS rank
				  FROM rocket_vehicles WHERE name ILIKE '%'||$1||'%'
				UNION ALL
				SELECT 'agency' AS kind, slug, name, 0 AS rank
				  FROM agencies WHERE name ILIKE '%'||$1||'%'
				UNION ALL
				SELECT 'satellite' AS kind, slug, name,
				       CASE WHEN name ILIKE '%'||$1||'%' THEN 0 ELSE 1 END AS rank
				  FROM satellites
				  WHERE name ILIKE '%'||$1||'%'
				     OR cospar_id ILIKE '%'||$1||'%'
				     OR (description IS NOT NULL AND description ILIKE '%'||$1||'%')
			) u
			ORDER BY rank, name
			LIMIT 50
		) ranked`, q)
}

// StatsOverview returns headline totals for the landing page.
func (h *Handlers) StatsOverview(c *fiber.Ctx) error {
	return h.queryObject(c, `
		SELECT row_to_json(t)
		FROM (
			SELECT
				(SELECT count(*) FROM satellites)       AS satellites,
				(SELECT count(*) FROM rocket_vehicles)  AS rockets,
				(SELECT count(*) FROM agencies)         AS agencies,
				(SELECT count(*) FROM launch_events)    AS launches,
				(SELECT count(*) FROM launch_sites)     AS launch_sites,
				(SELECT count(DISTINCT launch_year) FROM launch_events WHERE launch_year IS NOT NULL) AS years
		) t`)
}

// Leaderboard returns launch counts grouped by ?by=country|agency|decade.
func (h *Handlers) Leaderboard(c *fiber.Ctx) error {
	by := c.Query("by", "agency")
	var sql string
	switch by {
	case "country":
		sql = `SELECT json_agg(row_to_json(r))
			FROM (
				SELECT a.country_code AS key, COUNT(le.id) AS launches
				FROM launch_events le JOIN agencies a ON a.id = le.agency_id
				GROUP BY a.country_code ORDER BY launches DESC
			) r`
	case "decade":
		sql = `SELECT json_agg(row_to_json(r))
			FROM (
				SELECT (launch_year/10*10) AS key, COUNT(*) AS launches
				FROM launch_events WHERE launch_year IS NOT NULL
				GROUP BY 1 ORDER BY 1
			) r`
	case "agency":
		sql = `SELECT json_agg(row_to_json(r))
			FROM (
				SELECT a.name AS key, a.total_launches AS launches
				FROM agencies a ORDER BY a.total_launches DESC LIMIT 50
			) r`
	default:
		return fail(c, fiber.StatusBadRequest, "by must be country|agency|decade")
	}
	return h.queryJSON(c, "[]", sql)
}
