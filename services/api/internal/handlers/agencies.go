package handlers

import "github.com/gofiber/fiber/v2"

// ListAgencies returns all agencies sorted by launch count (most active first).
func (h *Handlers) ListAgencies(c *fiber.Ctx) error {
	return h.queryJSON(c, "[]", `
		SELECT json_agg(row_to_json(a) ORDER BY a.total_launches DESC)
		FROM (
			SELECT id, slug, name, abbrev, country_code, agency_type, founding_year,
			       logo_url, website, total_launches
			FROM agencies
		) a`)
}

// GetAgency returns one agency plus the rockets they manufacture, the vehicles
// they have actually flown, and their launch history (UUID or slug). Operators
// that build no rockets still get a populated page from `flown` + `launches`.
func (h *Handlers) GetAgency(c *fiber.Ctx) error {
	key := c.Params("id")
	return h.queryObject(c, `
		SELECT row_to_json(t)
		FROM (
			SELECT a.*,
			       COALESCE((
			         SELECT json_agg(json_build_object(
			           'id', rv.id, 'slug', rv.slug, 'name', rv.name, 'status', rv.status,
			           'total_launches', rv.total_launches))
			         FROM rocket_vehicles rv
			         JOIN rocket_families rf ON rf.id = rv.family_id
			         WHERE rf.manufacturer_id = a.id
			       ), '[]') AS rockets,
			       COALESCE((
			         SELECT json_agg(v ORDER BY v.cnt DESC)
			         FROM (
			           SELECT rv.id, rv.slug, rv.name, rv.status, COUNT(*) AS cnt
			           FROM launch_events le
			           JOIN rocket_vehicles rv ON rv.id = le.rocket_id
			           WHERE le.agency_id = a.id
			           GROUP BY rv.id, rv.slug, rv.name, rv.status
			         ) v
			       ), '[]') AS flown,
			       COALESCE((
			         SELECT json_agg(l ORDER BY l.launch_time DESC NULLS LAST)
			         FROM (
			           SELECT le.id, le.name, le.mission_name, le.launch_time,
			                  le.launch_year, le.outcome,
			                  rv.name AS rocket_name, rv.slug AS rocket_slug
			           FROM launch_events le
			           LEFT JOIN rocket_vehicles rv ON rv.id = le.rocket_id
			           WHERE le.agency_id = a.id
			           ORDER BY le.launch_time DESC NULLS LAST
			           LIMIT 200
			         ) l
			       ), '[]') AS launches
			FROM agencies a
			WHERE a.id::text = $1 OR a.slug = $1
		) t`, key)
}
