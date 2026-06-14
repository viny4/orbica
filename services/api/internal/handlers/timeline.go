package handlers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
)

// TimelineYears returns the per-year launch rollup (from year_summary).
func (h *Handlers) TimelineYears(c *fiber.Ctx) error {
	return h.queryJSON(c, "[]", `
		SELECT json_agg(row_to_json(y))
		FROM (
			SELECT launch_year, total_launches, successes, failures, agencies_active
			FROM year_summary
			ORDER BY launch_year
		) y`)
}

// TimelineYear returns launches in a given year (paginated for infinite scroll).
func (h *Handlers) TimelineYear(c *fiber.Ctx) error {
	year, err := strconv.Atoi(c.Params("year"))
	if err != nil {
		return fail(c, fiber.StatusBadRequest, "invalid year")
	}
	limit := clampInt(c.QueryInt("limit", 30), 1, 100)
	offset := maxInt(c.QueryInt("offset", 0), 0)
	return h.queryJSON(c, "[]", `
		SELECT json_agg(row_to_json(l))
		FROM (
			SELECT le.id, le.name, le.mission_name, le.launch_time, le.outcome,
			       le.orbit_achieved,
			       rv.id AS rocket_id, rv.slug AS rocket_slug, rv.name AS rocket_name,
			       a.id  AS agency_id, a.slug AS agency_slug, a.name AS agency_name, a.abbrev AS agency_abbrev
			FROM launch_events le
			LEFT JOIN rocket_vehicles rv ON rv.id = le.rocket_id
			LEFT JOIN agencies a ON a.id = le.agency_id
			WHERE le.launch_year = $1
			ORDER BY le.launch_time
			LIMIT $2 OFFSET $3
		) l`, year, limit, offset)
}
