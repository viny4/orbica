-- Read-only API surface for the frontend, exposed via PostgREST RPC.
-- Each function is the exact SQL its Go handler ran, so responses are
-- byte-identical and no frontend component needs to change.
-- SECURITY DEFINER + a pinned search_path: these functions are the ONLY
-- way anon reaches the data — tables keep RLS on with no anon grants.

CREATE OR REPLACE FUNCTION public.api_list_rockets(p1 text, p2 text, p3 text, p4 int, p5 int) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(row_to_json(r))
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
			WHERE rv.id::text = $1 OR rv.slug = $1
		) t), null::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_rocket_launches(p1 text) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(row_to_json(l) ORDER BY l.launch_time DESC)
		FROM (
			SELECT le.id, le.name, le.mission_name, le.launch_time, le.launch_year,
			       le.outcome, le.orbit_achieved
			FROM launch_events le
			WHERE le.rocket_id = (SELECT id FROM rocket_vehicles WHERE id::text = $1 OR slug = $1)
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
			WHERE le.rocket_id = (SELECT id FROM rocket_vehicles WHERE id::text = $1 OR slug = $1)
			ORDER BY s.launch_date DESC NULLS LAST
			LIMIT $2 OFFSET $3
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
			LIMIT $8 OFFSET $9
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
			WHERE s.id::text = $1 OR s.slug = $1
		) t), null::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_satellite_t_l_e(p1 text) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT row_to_json(t)
		FROM (
			SELECT ts.satellite_id, ts.captured_at, ts.tle_line1, ts.tle_line2, ts.source
			FROM tle_snapshots ts
			WHERE ts.satellite_id = (SELECT id FROM satellites WHERE id::text = $1 OR slug = $1)
			ORDER BY ts.captured_at DESC
			LIMIT 1
		) t), null::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_satellite_slugs() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(row_to_json(s))
		FROM (
			SELECT slug FROM satellites
			WHERE slug IS NOT NULL AND slug <> ''
			ORDER BY slug
		) s), '[]'::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_list_agencies() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(row_to_json(a) ORDER BY a.total_launches DESC)
		FROM (
			SELECT id, slug, name, abbrev, country_code, agency_type, founding_year,
			       logo_url, website, total_launches
			FROM agencies
		) a), '[]'::json)
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
			WHERE a.id::text = $1 OR a.slug = $1
		) t), null::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_timeline_years() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(row_to_json(y))
		FROM (
			SELECT launch_year, total_launches, successes, failures, agencies_active
			FROM year_summary
			ORDER BY launch_year
		) y), '[]'::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_timeline_year(p1 text, p2 int, p3 int) RETURNS json
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
			ORDER BY le.launch_time
			LIMIT $2 OFFSET $3
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
			ORDER BY le.launch_time DESC
			LIMIT $1
		) l), '[]'::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_get_launch(p1 text) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT row_to_json(t)
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
		) t), null::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_upcoming_launches(p1 int) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(row_to_json(l))
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
			WHERE le.outcome ILIKE 'Failure%' OR le.outcome ILIKE 'Partial Failure%'
			ORDER BY le.launch_time DESC
			LIMIT $1 OFFSET $2
		) l), '[]'::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_on_this_day(p1 text) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(row_to_json(l) ORDER BY l.launch_time DESC)
		FROM (
			SELECT le.id, le.name, le.mission_name, le.launch_time, le.launch_year,
			       le.outcome, rv.name AS rocket_name, a.name AS agency_name
			FROM launch_events le
			LEFT JOIN rocket_vehicles rv ON rv.id = le.rocket_id
			LEFT JOIN agencies a ON a.id = le.agency_id
			WHERE to_char(le.launch_time, 'MM-DD') = $1
		) l), '[]'::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_constellation(p1 text) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(row_to_json(s) ORDER BY s.launch_date)
		FROM (
			SELECT id, slug, name, norad_id, orbit_type, status, launch_date,
			       altitude_periapsis_km, altitude_apoapsis_km, inclination_deg
			FROM satellites
			WHERE constellation ILIKE $1
		) s), '[]'::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_list_constellations() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(row_to_json(t))
		FROM (
			SELECT constellation AS name, COUNT(*) AS count
			FROM satellites
			WHERE constellation IS NOT NULL AND constellation != ''
			GROUP BY constellation
			ORDER BY count DESC
		) t), '[]'::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_search(p1 text) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(json_build_object('kind', kind, 'slug', slug, 'name', name))
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
		) ranked), '[]'::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_stats_overview() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT row_to_json(t)
		FROM (
			SELECT
				(SELECT count(*) FROM satellites)       AS satellites,
				(SELECT count(*) FROM rocket_vehicles)  AS rockets,
				(SELECT count(*) FROM agencies)         AS agencies,
				(SELECT count(*) FROM launch_events)    AS launches,
				(SELECT count(*) FROM launch_sites)     AS launch_sites,
				(SELECT count(DISTINCT launch_year) FROM launch_events WHERE launch_year IS NOT NULL) AS years
		) t), null::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_conjunctions() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(row_to_json(x) ORDER BY x.miss_km)
		FROM (
			SELECT cj.sat_a_name, cj.sat_b_name, cj.tca, cj.miss_km, cj.rel_speed_kms,
			       sa.slug AS sat_a_slug, sb.slug AS sat_b_slug
			FROM conjunctions cj
			LEFT JOIN satellites sa ON sa.id = cj.sat_a_id
			LEFT JOIN satellites sb ON sb.id = cj.sat_b_id
		) x), '[]'::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_reentries() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(row_to_json(x))
		FROM (
			SELECT re.name, re.perigee_km, re.apogee_km, re.status, re.est_days, s.slug
			FROM reentries re
			LEFT JOIN satellites s ON s.id = re.satellite_id
			ORDER BY re.perigee_km
			LIMIT 120
		) x), '[]'::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_space_weather() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT row_to_json(x)
		FROM (
			SELECT kp, kp_state, solar_wind_kms, note, captured_at
			FROM space_weather ORDER BY captured_at DESC LIMIT 1
		) x), null::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_space_events() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(row_to_json(x) ORDER BY x.occurred_at DESC)
		FROM (
			SELECT kind, title, detail, occurred_at, href
			FROM space_events ORDER BY occurred_at DESC LIMIT 30
		) x), '[]'::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_rocket_articles(p1 text) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(row_to_json(x) ORDER BY x.published_at DESC NULLS LAST)
		FROM (
			SELECT a.id, a.title, a.url, a.summary, a.image_url, a.news_site, a.published_at
			FROM articles a
			JOIN article_links al ON al.article_id = a.id
			WHERE al.entity_type = 'rocket'
			  AND al.entity_key = (SELECT id::text FROM rocket_vehicles WHERE id::text = $1 OR slug = $1)
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
			WHERE s.id::text = $1 OR s.slug = $1
			LIMIT 12
		) x), '[]'::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_track_meta() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(json_build_object(
			'norad', s.norad_id, 'id', s.slug, 'name', s.name,
			'purpose', s.purpose, 'constellation', s.constellation,
			'owner', s.owner_code, 'orbit', s.orbit_type))
		FROM satellites s
		WHERE s.norad_id IS NOT NULL
		  AND EXISTS (SELECT 1 FROM tle_snapshots t WHERE t.satellite_id = s.id)), '[]'::json)
$fn$;

CREATE OR REPLACE FUNCTION public.api_latest_articles() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT json_agg(row_to_json(x) ORDER BY x.published_at DESC NULLS LAST)
		FROM (
			SELECT id, title, url, summary, image_url, news_site, published_at
			FROM articles
			ORDER BY published_at DESC NULLS LAST
			LIMIT 20
		) x), '[]'::json)
$fn$;

-- anon may reach the schema and execute these functions — nothing else.
GRANT USAGE ON SCHEMA public TO anon;
GRANT EXECUTE ON FUNCTION public.api_list_rockets(text, text, text, int, int) TO anon;
GRANT EXECUTE ON FUNCTION public.api_get_rocket(text) TO anon;
GRANT EXECUTE ON FUNCTION public.api_rocket_launches(text) TO anon;
GRANT EXECUTE ON FUNCTION public.api_rocket_payloads(text, int, int) TO anon;
GRANT EXECUTE ON FUNCTION public.api_list_satellites(text, text, text, text, text, text, text, int, int) TO anon;
GRANT EXECUTE ON FUNCTION public.api_get_satellite(text) TO anon;
GRANT EXECUTE ON FUNCTION public.api_satellite_t_l_e(text) TO anon;
GRANT EXECUTE ON FUNCTION public.api_satellite_slugs() TO anon;
GRANT EXECUTE ON FUNCTION public.api_list_agencies() TO anon;
GRANT EXECUTE ON FUNCTION public.api_get_agency(text) TO anon;
GRANT EXECUTE ON FUNCTION public.api_timeline_years() TO anon;
GRANT EXECUTE ON FUNCTION public.api_timeline_year(text, int, int) TO anon;
GRANT EXECUTE ON FUNCTION public.api_timeline_on_this_day(int) TO anon;
GRANT EXECUTE ON FUNCTION public.api_get_launch(text) TO anon;
GRANT EXECUTE ON FUNCTION public.api_upcoming_launches(int) TO anon;
GRANT EXECUTE ON FUNCTION public.api_failures(int, int) TO anon;
GRANT EXECUTE ON FUNCTION public.api_on_this_day(text) TO anon;
GRANT EXECUTE ON FUNCTION public.api_constellation(text) TO anon;
GRANT EXECUTE ON FUNCTION public.api_list_constellations() TO anon;
GRANT EXECUTE ON FUNCTION public.api_search(text) TO anon;
GRANT EXECUTE ON FUNCTION public.api_stats_overview() TO anon;
GRANT EXECUTE ON FUNCTION public.api_conjunctions() TO anon;
GRANT EXECUTE ON FUNCTION public.api_reentries() TO anon;
GRANT EXECUTE ON FUNCTION public.api_space_weather() TO anon;
GRANT EXECUTE ON FUNCTION public.api_space_events() TO anon;
GRANT EXECUTE ON FUNCTION public.api_rocket_articles(text) TO anon;
GRANT EXECUTE ON FUNCTION public.api_satellite_articles(text) TO anon;
GRANT EXECUTE ON FUNCTION public.api_track_meta() TO anon;
GRANT EXECUTE ON FUNCTION public.api_latest_articles() TO anon;
DROP FUNCTION IF EXISTS public.api_timeline_year(text, int, int);
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
			ORDER BY le.launch_time
			LIMIT $2 OFFSET $3
		) l), '[]'::json)
$fn$;
GRANT EXECUTE ON FUNCTION public.api_timeline_year(int, int, int) TO anon;

DROP FUNCTION IF EXISTS public.api_get_launch(text);
CREATE OR REPLACE FUNCTION public.api_get_launch(p1 uuid) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE((SELECT row_to_json(t)
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
		) t), null::json)
$fn$;
GRANT EXECUTE ON FUNCTION public.api_get_launch(uuid) TO anon;

