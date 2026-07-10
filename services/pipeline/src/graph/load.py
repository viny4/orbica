"""Batched UNWIND/MERGE writers.

Every statement MERGEs on the Postgres id, so a rebuild is idempotent: running
the sync twice yields the same graph, never duplicates.
"""
from __future__ import annotations

import logging
from typing import Any

log = logging.getLogger("graph.load")

BATCH = 5000


def merge(session, label: str, cypher: str, rows: list[dict[str, Any]]) -> int:
    """Run `cypher` (which must UNWIND $rows) over `rows` in batches."""
    if not rows:
        log.info("%-22s 0 (nothing to load)", label)
        return 0
    total = 0
    for i in range(0, len(rows), BATCH):
        chunk = rows[i : i + BATCH]
        session.execute_write(lambda tx, c=chunk: tx.run(cypher, rows=c).consume())
        total += len(chunk)
    log.info("%-22s %d", label, total)
    return total


# ── Node writers ──────────────────────────────────────────────────────────

AGENCIES = """
UNWIND $rows AS r
MERGE (a:Agency {id: r.id})
SET a.name = r.name, a.slug = r.slug, a.abbrev = r.abbrev,
    a.country_code = r.country_code, a.agency_type = r.agency_type,
    a.founding_year = r.founding_year
"""

COUNTRIES = """
UNWIND $rows AS r
MERGE (:Country {code: r.code})
"""

AGENCY_COUNTRY = """
UNWIND $rows AS r
MATCH (a:Agency {id: r.id})
MATCH (c:Country {code: r.country_code})
MERGE (a)-[:BASED_IN]->(c)
"""

FAMILIES = """
UNWIND $rows AS r
MERGE (f:RocketFamily {id: r.id})
SET f.name = r.name, f.country_code = r.country_code, f.first_flight = r.first_flight
"""

FAMILY_MANUFACTURER = """
UNWIND $rows AS r
MATCH (f:RocketFamily {id: r.id})
MATCH (a:Agency {id: r.manufacturer_id})
MERGE (f)-[:MANUFACTURED_BY]->(a)
"""

ROCKETS = """
UNWIND $rows AS r
MERGE (k:Rocket {id: r.id})
SET k.name = r.name, k.slug = r.slug, k.variant = r.variant, k.status = r.status,
    k.stages = r.stages, k.reusable = r.reusable,
    k.propellant_1 = r.propellant_1, k.propellant_2 = r.propellant_2,
    k.first_flight = r.first_flight, k.last_flight = r.last_flight,
    k.total_launches = r.total_launches,
    k.successful_launches = r.successful_launches,
    k.failed_launches = r.failed_launches,
    k.thrust_kn = r.thrust_kn, k.mass_kg = r.mass_kg, k.height_m = r.height_m,
    k.payload_leo_kg = r.payload_leo_kg
"""

ROCKET_FAMILY = """
UNWIND $rows AS r
MATCH (k:Rocket {id: r.id})
MATCH (f:RocketFamily {id: r.family_id})
MERGE (k)-[:IN_FAMILY]->(f)
"""

ENGINES = """
UNWIND $rows AS r
MERGE (e:Engine {id: r.id})
SET e.name = r.name, e.manufacturer = r.manufacturer, e.cycle = r.cycle,
    e.propellant = r.propellant, e.thrust_vac_kn = r.thrust_vac_kn,
    e.isp_vac_s = r.isp_vac_s
"""

ROCKET_ENGINES = """
UNWIND $rows AS r
MATCH (k:Rocket {id: r.rocket_id})
MATCH (e:Engine {id: r.engine_id})
MERGE (k)-[p:POWERED_BY {stage: r.stage}]->(e)
SET p.engine_count = r.engine_count, p.note = r.note
"""

SITES = """
UNWIND $rows AS r
MERGE (s:LaunchSite {id: r.id})
SET s.name = r.name, s.code = r.code, s.country_code = r.country_code,
    s.location = r.location, s.active = r.active
"""

SITE_OPERATOR = """
UNWIND $rows AS r
MATCH (s:LaunchSite {id: r.id})
MATCH (a:Agency {id: r.operator_id})
MERGE (s)-[:OPERATED_BY]->(a)
"""

LAUNCHES = """
UNWIND $rows AS r
MERGE (l:Launch {id: r.id})
SET l.name = r.name, l.launch_time = r.launch_time, l.launch_year = r.launch_year,
    l.outcome = r.outcome, l.mission_name = r.mission_name,
    l.mission_type = r.mission_type, l.orbit_achieved = r.orbit_achieved,
    l.failure_reason = r.failure_reason
"""

LAUNCH_ROCKET = """
UNWIND $rows AS r
MATCH (l:Launch {id: r.id})
MATCH (k:Rocket {id: r.rocket_id})
MERGE (l)-[:USED_ROCKET]->(k)
"""

LAUNCH_AGENCY = """
UNWIND $rows AS r
MATCH (l:Launch {id: r.id})
MATCH (a:Agency {id: r.agency_id})
MERGE (l)-[:LAUNCHED_BY]->(a)
"""

LAUNCH_SITE = """
UNWIND $rows AS r
MATCH (l:Launch {id: r.id})
MATCH (s:LaunchSite {id: r.launch_site_id})
MERGE (l)-[:FROM_SITE]->(s)
"""

SATELLITES = """
UNWIND $rows AS r
MERGE (s:Satellite {id: r.id})
SET s.name = r.name, s.slug = r.slug, s.norad_id = r.norad_id,
    s.cospar_id = r.cospar_id, s.status = r.status, s.object_type = r.object_type,
    s.launch_date = r.launch_date, s.launch_year = r.launch_year,
    s.reentry_date = r.reentry_date, s.mass_kg = r.mass_kg,
    s.inclination_deg = r.inclination_deg, s.period_minutes = r.period_minutes
"""

SAT_LAUNCH = """
UNWIND $rows AS r
MATCH (s:Satellite {id: r.id})
MATCH (l:Launch {id: r.launch_event_id})
MERGE (s)-[:DEPLOYED_ON]->(l)
"""

SAT_OPERATOR = """
UNWIND $rows AS r
MATCH (s:Satellite {id: r.id})
MATCH (a:Agency {id: r.operator_id})
MERGE (s)-[:OPERATED_BY]->(a)
"""

SAT_CONSTELLATION = """
UNWIND $rows AS r
MATCH (s:Satellite {id: r.id})
MERGE (c:Constellation {name: r.constellation})
MERGE (s)-[:MEMBER_OF]->(c)
"""

SAT_ORBIT = """
UNWIND $rows AS r
MATCH (s:Satellite {id: r.id})
MERGE (o:OrbitType {name: r.orbit_type})
MERGE (s)-[:IN_ORBIT]->(o)
"""

SAT_PURPOSE = """
UNWIND $rows AS r
MATCH (s:Satellite {id: r.id})
MERGE (p:Purpose {name: r.purpose})
MERGE (s)-[:SERVES]->(p)
"""

# ── Enrichment ────────────────────────────────────────────────────────────

CONJUNCTIONS = """
UNWIND $rows AS r
MATCH (a:Satellite {id: r.sat_a_id})
MATCH (b:Satellite {id: r.sat_b_id})
MERGE (a)-[c:CLOSE_APPROACH {tca: r.tca}]->(b)
SET c.miss_km = r.miss_km, c.rel_speed_kms = r.rel_speed_kms
"""

REENTRIES = """
UNWIND $rows AS r
MATCH (s:Satellite {id: r.satellite_id})
SET s.reentry_status = r.status, s.reentry_est_days = r.est_days,
    s.perigee_km = r.perigee_km, s.apogee_km = r.apogee_km
"""

ARTICLES = """
UNWIND $rows AS r
MERGE (a:Article {id: r.id})
SET a.title = r.title, a.url = r.url, a.news_site = r.news_site,
    a.published_at = r.published_at
"""

ARTICLE_ROCKET = """
UNWIND $rows AS r
MATCH (a:Article {id: r.article_id})
MATCH (k:Rocket {id: r.rocket_id})
MERGE (a)-[:MENTIONS]->(k)
"""

ARTICLE_CONSTELLATION = """
UNWIND $rows AS r
MATCH (a:Article {id: r.article_id})
MERGE (c:Constellation {name: r.constellation})
MERGE (a)-[:MENTIONS]->(c)
"""

# ── Analytics overlay ─────────────────────────────────────────────────────

SESSIONS = """
UNWIND $rows AS r
MERGE (s:Session {id: r.id})
SET s.first_seen = r.first_seen, s.last_seen = r.last_seen,
    s.events = r.events, s.country = r.country, s.city = r.city
"""

# One statement per section: the label can't be parameterised in Cypher.
VIEWED = {
    "rockets": """
        UNWIND $rows AS r
        MATCH (s:Session {id: r.session_id})
        MATCH (k:Rocket {slug: r.slug})
        MERGE (s)-[v:VIEWED]->(k)
        SET v.first_at = r.first_at, v.views = r.views
    """,
    "satellites": """
        UNWIND $rows AS r
        MATCH (s:Session {id: r.session_id})
        MATCH (k:Satellite {slug: r.slug})
        MERGE (s)-[v:VIEWED]->(k)
        SET v.first_at = r.first_at, v.views = r.views
    """,
    "agencies": """
        UNWIND $rows AS r
        MATCH (s:Session {id: r.session_id})
        MATCH (k:Agency {slug: r.slug})
        MERGE (s)-[v:VIEWED]->(k)
        SET v.first_at = r.first_at, v.views = r.views
    """,
}
