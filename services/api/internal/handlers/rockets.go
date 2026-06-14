package handlers

import "github.com/gofiber/fiber/v2"

// ListRockets returns a filterable rocket list.
// Query params: status, reusable (true/false), q (name search), limit, offset.
func (h *Handlers) ListRockets(c *fiber.Ctx) error {
	status := c.Query("status")
	reusable := c.Query("reusable")
	q := c.Query("q")
	limit := clampInt(c.QueryInt("limit", 60), 1, 200)
	offset := maxInt(c.QueryInt("offset", 0), 0)

	return h.queryJSON(c, "[]", `
		SELECT json_agg(row_to_json(r))
		FROM (
			SELECT rv.id, rv.slug, rv.name, rv.variant, rv.status, rv.height_m, rv.diameter_m,
			       rv.payload_leo_kg, rv.reusable, rv.total_launches,
			       rv.successful_launches, rv.failed_launches, rv.image_url,
			       rv.model_3d_url, rv.first_flight, rv.last_flight
			FROM rocket_vehicles rv
			WHERE ($1 = '' OR rv.status = $1)
			  AND ($2 = '' OR rv.reusable = ($2 = 'true'))
			  AND ($3 = '' OR rv.name ILIKE '%' || $3 || '%')
			ORDER BY rv.total_launches DESC NULLS LAST, rv.name
			LIMIT $4 OFFSET $5
		) r`, status, reusable, q, limit, offset)
}

// GetRocket returns full rocket detail (accepts UUID or slug).
func (h *Handlers) GetRocket(c *fiber.Ctx) error {
	key := c.Params("id")
	return h.queryObject(c, `
		SELECT row_to_json(t)
		FROM (
			SELECT rv.*,
			       row_to_json(rf) AS family,
			       row_to_json(a)  AS manufacturer,
			       COALESCE((
			         SELECT json_agg(eng ORDER BY eng.stage, eng.name)
			         FROM (
			           SELECT e.name, e.manufacturer, e.cycle, e.propellant,
			                  e.thrust_sl_kn, e.thrust_vac_kn, e.isp_vac_s, e.first_flight,
			                  e.description, re.stage, re.engine_count, re.note
			           FROM rocket_engines re
			           JOIN engines e ON e.id = re.engine_id
			           WHERE re.rocket_id = rv.id
			         ) eng
			       ), '[]'::json) AS engines
			FROM rocket_vehicles rv
			LEFT JOIN rocket_families rf ON rf.id = rv.family_id
			LEFT JOIN agencies a ON a.id = rf.manufacturer_id
			WHERE rv.id::text = $1 OR rv.slug = $1
		) t`, key)
}

// RocketLaunches returns the launch history for a rocket (UUID or slug).
func (h *Handlers) RocketLaunches(c *fiber.Ctx) error {
	key := c.Params("id")
	return h.queryJSON(c, "[]", `
		SELECT json_agg(row_to_json(l) ORDER BY l.launch_time DESC)
		FROM (
			SELECT le.id, le.name, le.mission_name, le.launch_time, le.launch_year,
			       le.outcome, le.orbit_achieved
			FROM launch_events le
			WHERE le.rocket_id = (SELECT id FROM rocket_vehicles WHERE id::text = $1 OR slug = $1)
		) l`, key)
}

// RocketPayloads returns satellites launched by this rocket (UUID or slug).
func (h *Handlers) RocketPayloads(c *fiber.Ctx) error {
	key := c.Params("id")
	return h.queryJSON(c, "[]", `
		SELECT json_agg(row_to_json(s) ORDER BY s.launch_date DESC)
		FROM (
			SELECT DISTINCT s.id, s.slug, s.name, s.norad_id, s.purpose, s.constellation,
			       s.orbit_type, s.status, s.launch_date
			FROM satellites s
			JOIN launch_events le ON le.id = s.launch_event_id
			WHERE le.rocket_id = (SELECT id FROM rocket_vehicles WHERE id::text = $1 OR slug = $1)
		) s`, key)
}
