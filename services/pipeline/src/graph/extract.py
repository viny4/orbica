"""Postgres -> row dicts for the graph loader.

UUIDs are cast to text and numerics to float in SQL: the Neo4j driver has no
mapping for psycopg's UUID/Decimal, and doing it here keeps the loader dumb.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from src.db.pool import cursor


def _value(v: Any) -> Any:
    """Coerce types the Bolt protocol can't pack. Belt-and-braces: the SQL below
    already casts the known columns, but a new numeric column must not be able
    to break the loader."""
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, UUID):
        return str(v)
    return v


def _rows(sql: str) -> list[dict[str, Any]]:
    with cursor() as cur:
        cur.execute(sql)
        return [{k: _value(v) for k, v in row.items()} for row in cur.fetchall()]


# ── Phase 1: core domain ──────────────────────────────────────────────────

def agencies() -> list[dict]:
    return _rows("""
        SELECT id::text AS id, name, slug, abbrev, country_code,
               agency_type, founding_year
        FROM agencies
    """)


def rocket_families() -> list[dict]:
    return _rows("""
        SELECT id::text AS id, name, country_code, first_flight,
               manufacturer_id::text AS manufacturer_id
        FROM rocket_families
    """)


def rockets() -> list[dict]:
    return _rows("""
        SELECT id::text AS id, name, slug, variant, status,
               family_id::text AS family_id, stages, reusable,
               propellant_1, propellant_2,
               first_flight, last_flight,
               total_launches, successful_launches, failed_launches,
               thrust_kn::float AS thrust_kn,
               mass_kg::float AS mass_kg,
               height_m::float AS height_m,
               payload_leo_kg::float AS payload_leo_kg
        FROM rocket_vehicles
    """)


def engines() -> list[dict]:
    return _rows("""
        SELECT id::text AS id, name, manufacturer, cycle, propellant,
               thrust_vac_kn::float AS thrust_vac_kn,
               isp_vac_s::float AS isp_vac_s
        FROM engines
    """)


def rocket_engines() -> list[dict]:
    return _rows("""
        SELECT rocket_id::text AS rocket_id, engine_id::text AS engine_id,
               stage, engine_count, note
        FROM rocket_engines
        WHERE rocket_id IS NOT NULL AND engine_id IS NOT NULL
    """)


def launch_sites() -> list[dict]:
    return _rows("""
        SELECT id::text AS id, name, code, country_code, location, active,
               operator_id::text AS operator_id
        FROM launch_sites
    """)


def launches() -> list[dict]:
    return _rows("""
        SELECT id::text AS id, name, launch_time, launch_year, outcome,
               mission_name, mission_type, orbit_achieved, failure_reason,
               rocket_id::text AS rocket_id,
               agency_id::text AS agency_id,
               launch_site_id::text AS launch_site_id
        FROM launch_events
    """)


def satellites() -> list[dict]:
    return _rows("""
        SELECT id::text AS id, name, slug, norad_id, cospar_id, status,
               object_type, purpose, constellation, orbit_type,
               launch_date, launch_year, reentry_date,
               mass_kg::float AS mass_kg,
               inclination_deg::float AS inclination_deg,
               period_minutes::float AS period_minutes,
               operator_id::text AS operator_id,
               launch_event_id::text AS launch_event_id
        FROM satellites
    """)


def countries() -> list[dict]:
    """Union of country codes seen on agencies, families and sites."""
    return _rows("""
        SELECT DISTINCT country_code AS code FROM (
            SELECT country_code FROM agencies
            UNION SELECT country_code FROM rocket_families
            UNION SELECT country_code FROM launch_sites
        ) c WHERE country_code IS NOT NULL AND country_code <> ''
    """)


# ── Phase 2: enrichment ───────────────────────────────────────────────────

def conjunctions() -> list[dict]:
    return _rows("""
        SELECT sat_a_id::text AS sat_a_id, sat_b_id::text AS sat_b_id,
               tca, miss_km::float AS miss_km,
               rel_speed_kms::float AS rel_speed_kms
        FROM conjunctions
        WHERE sat_a_id IS NOT NULL AND sat_b_id IS NOT NULL
    """)


def reentries() -> list[dict]:
    return _rows("""
        SELECT satellite_id::text AS satellite_id, status, est_days,
               perigee_km::float AS perigee_km, apogee_km::float AS apogee_km
        FROM reentries WHERE satellite_id IS NOT NULL
    """)


def articles() -> list[dict]:
    return _rows("""
        SELECT id::text AS id, title, url, news_site, published_at
        FROM articles
    """)


def article_rocket_links() -> list[dict]:
    """entity_key holds the rocket UUID for entity_type='rocket'."""
    return _rows("""
        SELECT article_id::text AS article_id, entity_key AS rocket_id
        FROM article_links
        WHERE entity_type = 'rocket'
          AND entity_key ~ '^[0-9a-f-]{36}$'
    """)


def article_constellation_links() -> list[dict]:
    return _rows("""
        SELECT article_id::text AS article_id, entity_key AS constellation
        FROM article_links
        WHERE entity_type = 'constellation' AND entity_key <> ''
    """)


# ── Phase 3: analytics overlay ────────────────────────────────────────────

def sessions() -> list[dict]:
    return _rows("""
        SELECT session_id::text AS id,
               min(timestamp) AS first_seen,
               max(timestamp) AS last_seen,
               count(*) AS events,
               max(country) AS country,
               max(city) AS city
        FROM analytics_events
        WHERE NOT is_bot
        GROUP BY session_id
    """)


def session_views() -> list[dict]:
    """Page views that resolve to an entity slug, e.g. /rockets/falcon-9."""
    return _rows("""
        SELECT session_id::text AS session_id,
               split_part(path, '/', 2) AS section,
               split_part(path, '/', 3) AS slug,
               min(timestamp) AS first_at,
               count(*) AS views
        FROM analytics_events
        WHERE NOT is_bot
          AND path ~ '^/(rockets|satellites|agencies)/[^/]+$'
        GROUP BY 1, 2, 3
    """)
