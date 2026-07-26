package handlers

import "github.com/gofiber/fiber/v2"

// ListSatellites returns a filterable satellite list.
// Query params: purpose, orbit_type, status, constellation, owner, object_type, q, limit, offset.
func (h *Handlers) ListSatellites(c *fiber.Ctx) error {
	purpose := c.Query("purpose")
	orbit := c.Query("orbit_type")
	status := c.Query("status")
	constellation := c.Query("constellation")
	owner := c.Query("owner")
	objectType := c.Query("object_type")
	q := c.Query("q")
	limit := clampInt(c.QueryInt("limit", 60), 1, 200)
	offset := maxInt(c.QueryInt("offset", 0), 0)

	return h.queryJSON(c, "[]", `
		SELECT json_agg(row_to_json(s))
		FROM (
			SELECT s.id, s.slug, s.name, s.cospar_id, s.norad_id, s.purpose, s.constellation,
			       s.orbit_type, s.status, s.owner_code, s.object_type, s.launch_date,
			       s.launch_year, s.image_url
			FROM satellites s
			WHERE ($1 = '' OR s.purpose = $1)
			  AND ($2 = '' OR s.orbit_type = $2)
			  AND ($3 = '' OR s.status = $3)
			  AND ($4 = '' OR s.constellation = $4)
			  AND ($5 = '' OR s.owner_code = $5)
			  AND ($6 = '' OR s.object_type = $6)
			  AND ($7 = '' OR s.name ILIKE '%' || $7 || '%')
			ORDER BY 
			  (s.image_url IS NOT NULL) DESC,
			  CASE WHEN s.name ILIKE '%ISS%' OR s.name ILIKE '%Hubble%' OR s.name ILIKE '%James Webb%' THEN 0 ELSE 1 END ASC,
			  s.launch_date DESC NULLS LAST, 
			  s.name
			LIMIT $8 OFFSET $9
		) s`, purpose, orbit, status, constellation, owner, objectType, q, limit, offset)
}

// GetSatellite returns full detail (UUID or slug): operator, launch site, rocket.
func (h *Handlers) GetSatellite(c *fiber.Ctx) error {
	key := c.Params("id")
	return h.queryObject(c, `
		SELECT row_to_json(t)
		FROM (
			SELECT s.*,
			       row_to_json(op) AS operator,
			       (SELECT row_to_json(o)
			          FROM satcat_owners o WHERE o.code = s.owner_code) AS owner_info,
			       (SELECT row_to_json(ls)
			          FROM launch_site_codes ls WHERE ls.code = s.launch_site_code) AS launch_site,
			       (SELECT row_to_json(lr) FROM (
			          SELECT le.id AS launch_id, le.name AS launch_name, le.launch_time,
			                 le.mission_name, le.outcome,
			                 rv.id AS rocket_id, rv.slug AS rocket_slug, rv.name AS rocket_name,
			                 a.id AS agency_id, a.slug AS agency_slug, a.name AS agency_name
			          FROM launch_events le
			          LEFT JOIN rocket_vehicles rv ON rv.id = le.rocket_id
			          LEFT JOIN agencies a ON a.id = le.agency_id
			          WHERE le.id = s.launch_event_id
			       ) lr) AS launch
			FROM satellites s
			LEFT JOIN agencies op ON op.id = s.operator_id
			WHERE s.id::text = $1 OR s.slug = $1
		) t`, key)
}

// SatelliteTLE returns the most recent TLE snapshot (UUID or slug).
func (h *Handlers) SatelliteTLE(c *fiber.Ctx) error {
	key := c.Params("id")
	return h.queryObject(c, `
		SELECT row_to_json(t)
		FROM (
			SELECT ts.satellite_id, ts.captured_at, ts.tle_line1, ts.tle_line2, ts.source
			FROM tle_snapshots ts
			WHERE ts.satellite_id = (SELECT id FROM satellites WHERE id::text = $1 OR slug = $1)
			ORDER BY ts.captured_at DESC
			LIMIT 1
		) t`, key)
}

// SatelliteSlugs returns every satellite slug in one payload — it feeds the web
// sitemap, which needs the full URL set (27k+) rather than a page.
func (h *Handlers) SatelliteSlugs(c *fiber.Ctx) error {
	return h.queryJSON(c, "[]", `
		SELECT json_agg(row_to_json(s))
		FROM (
			SELECT slug FROM satellites
			WHERE slug IS NOT NULL AND slug <> ''
			ORDER BY slug
		) s`)
}
