package handlers

import "github.com/gofiber/fiber/v2"

// RocketArticles returns real news linked to a rocket.
func (h *Handlers) RocketArticles(c *fiber.Ctx) error {
	id := c.Params("id")
	return h.queryJSON(c, "[]", `
		SELECT json_agg(row_to_json(x) ORDER BY x.published_at DESC NULLS LAST)
		FROM (
			SELECT a.id, a.title, a.url, a.summary, a.image_url, a.news_site, a.published_at
			FROM articles a
			JOIN article_links al ON al.article_id = a.id
			WHERE al.entity_type = 'rocket'
			  AND al.entity_key = (SELECT id::text FROM rocket_vehicles WHERE id::text = $1 OR slug = $1)
			LIMIT 12
		) x`, id)
}

// SatelliteArticles returns news tied to the satellite's constellation or the
// rocket that launched it.
func (h *Handlers) SatelliteArticles(c *fiber.Ctx) error {
	id := c.Params("id")
	return h.queryJSON(c, "[]", `
		SELECT json_agg(row_to_json(x) ORDER BY x.published_at DESC NULLS LAST)
		FROM (
			SELECT DISTINCT a.id, a.title, a.url, a.summary, a.image_url, a.news_site, a.published_at
			FROM satellites s
			JOIN article_links al
			  ON (al.entity_type = 'constellation' AND al.entity_key = s.constellation)
			  OR (al.entity_type = 'rocket' AND al.entity_key = (
			        SELECT le.rocket_id::text FROM launch_events le WHERE le.id = s.launch_event_id))
			JOIN articles a ON a.id = al.article_id
			WHERE s.id::text = $1 OR s.slug = $1
			LIMIT 12
		) x`, id)
}

// TrackMeta returns static metadata for every trackable satellite, keyed by
// NORAD id, so the live tracker can join it to the position stream for
// colouring, filtering and analytics. One cached fetch; positions stream over WS.
func (h *Handlers) TrackMeta(c *fiber.Ctx) error {
	return h.queryJSON(c, "[]", `
		SELECT json_agg(json_build_object(
			'norad', s.norad_id, 'id', s.slug, 'name', s.name,
			'purpose', s.purpose, 'constellation', s.constellation,
			'owner', s.owner_code, 'orbit', s.orbit_type))
		FROM satellites s
		WHERE s.norad_id IS NOT NULL
		  AND EXISTS (SELECT 1 FROM tle_snapshots t WHERE t.satellite_id = s.id)`)
}

// LatestArticles returns the general recent feed.
func (h *Handlers) LatestArticles(c *fiber.Ctx) error {
	return h.queryJSON(c, "[]", `
		SELECT json_agg(row_to_json(x) ORDER BY x.published_at DESC NULLS LAST)
		FROM (
			SELECT id, title, url, summary, image_url, news_site, published_at
			FROM articles
			ORDER BY published_at DESC NULLS LAST
			LIMIT 20
		) x`)
}
