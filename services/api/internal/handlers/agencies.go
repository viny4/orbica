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

// GetAgency returns one agency plus the rockets they manufacture (UUID or slug).
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
			       ), '[]') AS rockets
			FROM agencies a
			WHERE a.id::text = $1 OR a.slug = $1
		) t`, key)
}
