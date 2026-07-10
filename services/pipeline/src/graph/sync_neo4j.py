"""Rebuild the local Neo4j projection from Postgres.

    python -m src.graph.sync_neo4j                 # all phases, incremental MERGE
    python -m src.graph.sync_neo4j --wipe          # clean rebuild
    python -m src.graph.sync_neo4j --phase core    # core | enrich | analytics | all

Local-only. Requires NEO4J_URI in .env; exits cleanly (rc 0) when unset so it can
never break a scripted run that doesn't have a graph database.
"""
from __future__ import annotations

import argparse
import logging
import sys
import time

from src.graph import client, extract, load, schema

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("graph.sync")

PHASES = ("core", "enrich", "analytics", "all")


def _nonempty(rows: list[dict], key: str) -> list[dict]:
    """Rows whose `key` is set — used to skip MATCHes that would find nothing."""
    return [r for r in rows if r.get(key)]


def load_core(session) -> None:
    agencies = extract.agencies()
    load.merge(session, "Agency", load.AGENCIES, agencies)
    load.merge(session, "Country", load.COUNTRIES, extract.countries())
    load.merge(session, "Agency->Country", load.AGENCY_COUNTRY, _nonempty(agencies, "country_code"))

    families = extract.rocket_families()
    load.merge(session, "RocketFamily", load.FAMILIES, families)
    load.merge(session, "Family->Agency", load.FAMILY_MANUFACTURER, _nonempty(families, "manufacturer_id"))

    rockets = extract.rockets()
    load.merge(session, "Rocket", load.ROCKETS, rockets)
    load.merge(session, "Rocket->Family", load.ROCKET_FAMILY, _nonempty(rockets, "family_id"))

    load.merge(session, "Engine", load.ENGINES, extract.engines())
    load.merge(session, "Rocket->Engine", load.ROCKET_ENGINES, extract.rocket_engines())

    sites = extract.launch_sites()
    load.merge(session, "LaunchSite", load.SITES, sites)
    load.merge(session, "Site->Agency", load.SITE_OPERATOR, _nonempty(sites, "operator_id"))

    launches = extract.launches()
    load.merge(session, "Launch", load.LAUNCHES, launches)
    load.merge(session, "Launch->Rocket", load.LAUNCH_ROCKET, _nonempty(launches, "rocket_id"))
    load.merge(session, "Launch->Agency", load.LAUNCH_AGENCY, _nonempty(launches, "agency_id"))
    load.merge(session, "Launch->Site", load.LAUNCH_SITE, _nonempty(launches, "launch_site_id"))

    sats = extract.satellites()
    load.merge(session, "Satellite", load.SATELLITES, sats)
    load.merge(session, "Sat->Launch", load.SAT_LAUNCH, _nonempty(sats, "launch_event_id"))
    load.merge(session, "Sat->Agency", load.SAT_OPERATOR, _nonempty(sats, "operator_id"))
    load.merge(session, "Sat->Constellation", load.SAT_CONSTELLATION, _nonempty(sats, "constellation"))
    load.merge(session, "Sat->OrbitType", load.SAT_ORBIT, _nonempty(sats, "orbit_type"))
    load.merge(session, "Sat->Purpose", load.SAT_PURPOSE, _nonempty(sats, "purpose"))


def load_enrich(session) -> None:
    load.merge(session, "CloseApproach", load.CONJUNCTIONS, extract.conjunctions())
    load.merge(session, "Reentry props", load.REENTRIES, extract.reentries())
    load.merge(session, "Article", load.ARTICLES, extract.articles())
    load.merge(session, "Article->Rocket", load.ARTICLE_ROCKET, extract.article_rocket_links())
    load.merge(session, "Article->Constellation", load.ARTICLE_CONSTELLATION, extract.article_constellation_links())


def load_analytics(session) -> None:
    load.merge(session, "Session", load.SESSIONS, extract.sessions())
    views = extract.session_views()
    for section, cypher in load.VIEWED.items():
        rows = [v for v in views if v["section"] == section]
        load.merge(session, f"Session->{section}", cypher, rows)


def main() -> int:
    ap = argparse.ArgumentParser(description="Rebuild the Neo4j graph from Postgres.")
    ap.add_argument("--wipe", action="store_true", help="delete all nodes first (clean rebuild)")
    ap.add_argument("--phase", choices=PHASES, default="all")
    args = ap.parse_args()

    if not client.enabled():
        log.warning("NEO4J_URI is not set — skipping graph sync (this is not an error)")
        return 0

    started = time.time()
    with client.session() as session:
        if args.wipe:
            schema.wipe(session)
        schema.apply(session)

        if args.phase in ("core", "all"):
            load_core(session)
        if args.phase in ("enrich", "all"):
            load_enrich(session)
        if args.phase in ("analytics", "all"):
            load_analytics(session)

        nodes = session.run("MATCH (n) RETURN count(n) AS c").single()["c"]
        rels = session.run("MATCH ()-[r]->() RETURN count(r) AS c").single()["c"]

    client.close()
    log.info("graph ready: %d nodes, %d relationships in %.1fs", nodes, rels, time.time() - started)
    return 0


if __name__ == "__main__":
    sys.exit(main())
