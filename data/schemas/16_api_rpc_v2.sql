-- ORBICA — read API v2: faster lookups, bounded queries, correct failures.
--
-- Additive and backwards compatible: every function keeps its name and
-- signature (so existing GRANTs and callers keep working), new columns are
-- nullable, and nothing is dropped. Rollback: data/schemas/rollback/16_down.sql.
--
-- Why, with measurements from a production-sized copy (27k satellites, 168k TLE
-- snapshots):
--   * `id::text = $1 OR slug = $1` cast every primary key to text and forced a
--     sequential scan: satellite lookup 12.5 ms → 0.02 ms index lookup.
--   * The RPCs passed client-supplied LIMITs straight through; with the public
--     anon key anyone could pull all 27k satellites in one request. Now clamped
--     to the same bounds as the Go API.
--   * Outcomes are stored lowercase, so `ILIKE 'Partial Failure%'` never matched
--     'partial_failure' — the failure archive silently omitted all of them.
--   * api_all_tles sorted all 168k snapshots (26 MB on-disk sort, 152 ms) and
--     intermittently hit Supabase's 3 s anon statement timeout. A per-satellite
--     index probe returns the same rows in ~55 ms with no sort spill.
--   * Search scanned every satellite description: 36 ms → ~1–7 ms with trigram
--     indexes on description and cospar_id (≈7 MB of index).

-- ── Image attribution + card-sized renditions (filled by the LL2 sync) ──────
ALTER TABLE rocket_vehicles ADD COLUMN IF NOT EXISTS thumbnail_url      TEXT;
ALTER TABLE rocket_vehicles ADD COLUMN IF NOT EXISTS image_credit       TEXT;
ALTER TABLE rocket_vehicles ADD COLUMN IF NOT EXISTS image_license_name TEXT;
ALTER TABLE rocket_vehicles ADD COLUMN IF NOT EXISTS image_license_url  TEXT;

-- ── Search indexes ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_satellites_description_trgm ON satellites USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_satellites_cospar_trgm      ON satellites USING gin (cospar_id gin_trgm_ops);
-- Freshness lookups (api_sync_status) read the newest row per job.
CREATE INDEX IF NOT EXISTS idx_sync_logs_job_time ON sync_logs (job_name, timestamp DESC);

-- ── Functions ───────────────────────────────────────────────────────────────
-- Lookup idiom used below:
--   slug = $1 OR id = CASE WHEN $1 ~* '<uuid>' THEN $1::uuid END
-- The regex is IMMUTABLE, so when the planner inlines a constant it folds the
-- CASE before ever evaluating the cast — a slug never reaches `::uuid`.

CREATE OR REPLACE FUNCTION public.api_list_rockets(p1 text, p2 text, p3 text, p4 int, p5 int) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(row_to_json(r))
		FROM (
			SELECT rv.id, rv.slug, rv.name, rv.variant, rv.status, rv.height_m, rv.diameter_m,
			       rv.payload_leo_kg, rv.reusable, rv.total_launches,
			       rv.successful_launches, rv.failed_launches, rv.image_url, rv.thumbnail_url,
			       rv.model_3d_url, rv.first_flight, rv.last_flight
			FROM rocket_vehicles rv
			WHERE ($1 = '' OR rv.status = $1)
			  AND ($2 = '' OR rv.reusable = ($2 = 'true'))
			  AND ($3 = '' OR rv.name ILIKE '%' || $3 || '%')
			ORDER BY rv.total_launches DESC NULLS LAST, rv.name
			LIMIT LEAST(GREATEST(COALESCE($4, 60), 1), 1000) OFFSET GREATEST(COALESCE($5, 0), 0)
		) r), '[]'::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_get_rocket(p1 text) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT row_to_json(t)
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
			WHERE rv.slug = $1
			   OR rv.id = CASE WHEN $1 ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN $1::uuid END
		) t), null::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_rocket_launches(p1 text) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(row_to_json(l) ORDER BY l.launch_time DESC)
		FROM (
			SELECT le.id, le.name, le.mission_name, le.launch_time, le.launch_year,
			       le.outcome, le.orbit_achieved
			FROM launch_events le
			WHERE le.rocket_id = (
			  SELECT k.id FROM rocket_vehicles k
			  WHERE k.slug = $1
			     OR k.id = CASE WHEN $1 ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN $1::uuid END)
		) l), '[]'::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_rocket_payloads(p1 text, p2 int, p3 int) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(row_to_json(s))
		FROM (
			SELECT DISTINCT s.id, s.slug, s.name, s.norad_id, s.purpose, s.constellation,
			       s.orbit_type, s.status, s.launch_date
			FROM satellites s
			JOIN launch_events le ON le.id = s.launch_event_id
			WHERE le.rocket_id = (
			  SELECT k.id FROM rocket_vehicles k
			  WHERE k.slug = $1
			     OR k.id = CASE WHEN $1 ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN $1::uuid END)
			ORDER BY s.launch_date DESC NULLS LAST
			LIMIT LEAST(GREATEST(COALESCE($2, 60), 1), 1000) OFFSET GREATEST(COALESCE($3, 0), 0)
		) s), '[]'::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_list_satellites(p1 text, p2 text, p3 text, p4 text, p5 text, p6 text, p7 text, p8 int, p9 int) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(row_to_json(s))
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
			LIMIT LEAST(GREATEST(COALESCE($8, 60), 1), 200) OFFSET GREATEST(COALESCE($9, 0), 0)
		) s), '[]'::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_get_satellite(p1 text) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT row_to_json(t)
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
			WHERE s.slug = $1
			   OR s.id = CASE WHEN $1 ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN $1::uuid END
		) t), null::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_satellite_tle(p1 text) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT row_to_json(t)
		FROM (
			SELECT ts.satellite_id, ts.captured_at, ts.tle_line1, ts.tle_line2, ts.source
			FROM tle_snapshots ts
			WHERE ts.satellite_id = (
			  SELECT k.id FROM satellites k
			  WHERE k.slug = $1
			     OR k.id = CASE WHEN $1 ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN $1::uuid END)
			ORDER BY ts.captured_at DESC
			LIMIT 1
		) t), null::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_get_agency(p1 text) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT row_to_json(t)
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
			WHERE a.slug = $1
			   OR a.id = CASE WHEN $1 ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN $1::uuid END
		) t), null::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_timeline_year(p1 int, p2 int, p3 int) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(row_to_json(l))
		FROM (
			SELECT le.id, le.name, le.mission_name, le.launch_time, le.outcome,
			       le.orbit_achieved,
			       rv.id AS rocket_id, rv.slug AS rocket_slug, rv.name AS rocket_name,
			       a.id  AS agency_id, a.slug AS agency_slug, a.name AS agency_name, a.abbrev AS agency_abbrev
			FROM launch_events le
			LEFT JOIN rocket_vehicles rv ON rv.id = le.rocket_id
			LEFT JOIN agencies a ON a.id = le.agency_id
			WHERE le.launch_year = $1
			ORDER BY le.launch_time, le.id
			LIMIT LEAST(GREATEST(COALESCE($2, 30), 1), 100) OFFSET GREATEST(COALESCE($3, 0), 0)
		) l), '[]'::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_timeline_on_this_day(p1 int) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(row_to_json(l))
		FROM (
			SELECT le.id, le.name, le.mission_name, le.launch_time, le.launch_year, le.outcome,
			       le.orbit_achieved,
			       rv.id AS rocket_id, rv.slug AS rocket_slug, rv.name AS rocket_name,
			       a.id  AS agency_id, a.slug AS agency_slug, a.name AS agency_name, a.abbrev AS agency_abbrev
			FROM launch_events le
			LEFT JOIN rocket_vehicles rv ON rv.id = le.rocket_id
			LEFT JOIN agencies a ON a.id = le.agency_id
			WHERE EXTRACT(MONTH FROM le.launch_time) = EXTRACT(MONTH FROM CURRENT_DATE)
			  AND EXTRACT(DAY FROM le.launch_time) = EXTRACT(DAY FROM CURRENT_DATE)
			  AND le.launch_time < NOW()
			ORDER BY le.launch_time DESC
			LIMIT LEAST(GREATEST(COALESCE($1, 10), 1), 50)
		) l), '[]'::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_failures(p1 int, p2 int) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(row_to_json(l))
		FROM (
			SELECT le.id, le.name, le.mission_name, le.mission_description, le.launch_time, le.launch_year,
			       le.outcome, le.mission_type,
			       rv.slug AS rocket_slug, rv.name AS rocket_name,
			       a.slug AS agency_slug, a.name AS agency_name,
			       ls.name AS site_name
			FROM launch_events le
			LEFT JOIN rocket_vehicles rv ON rv.id = le.rocket_id
			LEFT JOIN agencies a ON a.id = le.agency_id
			LEFT JOIN launch_sites ls ON ls.id = le.launch_site_id
			WHERE le.outcome IN ('failure', 'partial_failure')
			ORDER BY le.launch_time DESC
			LIMIT LEAST(GREATEST(COALESCE($1, 100), 1), 1000) OFFSET LEAST(GREATEST(COALESCE($2, 0), 0), 100000)
		) l), '[]'::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_rocket_articles(p1 text) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(row_to_json(x) ORDER BY x.published_at DESC NULLS LAST)
		FROM (
			SELECT a.id, a.title, a.url, a.summary, a.image_url, a.news_site, a.published_at
			FROM articles a
			JOIN article_links al ON al.article_id = a.id
			WHERE al.entity_type = 'rocket'
			  AND al.entity_key = (
			    SELECT k.id::text FROM rocket_vehicles k
			    WHERE k.slug = $1
			       OR k.id = CASE WHEN $1 ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN $1::uuid END)
			ORDER BY a.published_at DESC NULLS LAST
			LIMIT 12
		) x), '[]'::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_satellite_articles(p1 text) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(row_to_json(x) ORDER BY x.published_at DESC NULLS LAST)
		FROM (
			SELECT DISTINCT a.id, a.title, a.url, a.summary, a.image_url, a.news_site, a.published_at
			FROM satellites s
			JOIN article_links al
			  ON (al.entity_type = 'constellation' AND al.entity_key = s.constellation)
			  OR (al.entity_type = 'rocket' AND al.entity_key = (
			        SELECT le.rocket_id::text FROM launch_events le WHERE le.id = s.launch_event_id))
			JOIN articles a ON a.id = al.article_id
			WHERE s.slug = $1
			   OR s.id = CASE WHEN $1 ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN $1::uuid END
			ORDER BY a.published_at DESC NULLS LAST
			LIMIT 12
		) x), '[]'::json)
$fn$;

-- Newest TLE per satellite as compact [norad, line1, line2] triples, via one
-- index probe per satellite instead of sorting every snapshot.
CREATE OR REPLACE FUNCTION public.api_all_tles() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE(json_agg(json_build_array(s.norad_id, t.tle_line1, t.tle_line2) ORDER BY s.norad_id), '[]'::json)
  FROM satellites s
  CROSS JOIN LATERAL (
    SELECT ts.tle_line1, ts.tle_line2
    FROM tle_snapshots ts
    WHERE ts.satellite_id = s.id
    ORDER BY ts.captured_at DESC
    LIMIT 1
  ) t
  WHERE s.norad_id IS NOT NULL
$fn$;

-- Public pipeline freshness: last run, how it ended, last clean run. No
-- per-job details (those stay in the admin sync log).
CREATE OR REPLACE FUNCTION public.api_sync_status() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT json_build_object(
    'last_run_at',     (SELECT timestamp FROM sync_logs WHERE job_name = 'refresh-run' ORDER BY timestamp DESC LIMIT 1),
    'last_run_status', (SELECT status    FROM sync_logs WHERE job_name = 'refresh-run' ORDER BY timestamp DESC LIMIT 1),
    'last_success_at', (SELECT timestamp FROM sync_logs WHERE job_name = 'refresh-run' AND status = 'success' ORDER BY timestamp DESC LIMIT 1)
  )
$fn$;

GRANT EXECUTE ON FUNCTION public.api_sync_status() TO anon;
