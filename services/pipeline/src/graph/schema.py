"""Constraints + indexes for the graph. Applied before any load.

Uniqueness constraints double as the backing index for the MERGE keys, so the
loader stays fast without extra index definitions on those properties.
"""
from __future__ import annotations

import logging

log = logging.getLogger("graph.schema")

# (label, property) pairs whose MERGE key must be unique.
_UNIQUE = [
    ("Agency", "id"),
    ("RocketFamily", "id"),
    ("Rocket", "id"),
    ("Engine", "id"),
    ("LaunchSite", "id"),
    ("Launch", "id"),
    ("Satellite", "id"),
    ("Article", "id"),
    ("Session", "id"),
    ("Constellation", "name"),
    ("OrbitType", "name"),
    ("Purpose", "name"),
    ("Country", "code"),
]

# Lookup paths that aren't MERGE keys (slug joins from analytics, NORAD search).
_INDEX = [
    ("Rocket", "slug"),
    ("Satellite", "slug"),
    ("Agency", "slug"),
    ("Satellite", "norad_id"),
    ("Launch", "launch_year"),
]


def apply(session) -> None:
    for label, prop in _UNIQUE:
        session.run(
            f"CREATE CONSTRAINT {label.lower()}_{prop}_unique IF NOT EXISTS "
            f"FOR (n:{label}) REQUIRE n.{prop} IS UNIQUE"
        )
    for label, prop in _INDEX:
        session.run(
            f"CREATE INDEX {label.lower()}_{prop}_idx IF NOT EXISTS "
            f"FOR (n:{label}) ON (n.{prop})"
        )
    log.info("applied %d constraints + %d indexes", len(_UNIQUE), len(_INDEX))


def wipe(session) -> None:
    """Detach-delete everything, in batches so a big graph won't blow up heap."""
    session.run(
        "MATCH (n) CALL { WITH n DETACH DELETE n } IN TRANSACTIONS OF 10000 ROWS"
    )
    log.info("wiped graph")
