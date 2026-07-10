"""Neo4j driver for the local graph projection.

The graph is a *derived* view of Postgres: one-way, fully rebuildable, and never
a source of truth. It is local-only — the API and the scheduled sync must keep
working with Neo4j down, so every entry point checks `enabled()` first.
"""
from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from neo4j import Driver, GraphDatabase, Session

from src.config import settings

_driver: Driver | None = None


def enabled() -> bool:
    """True when a Neo4j target is configured. Callers must no-op otherwise."""
    return bool(settings.neo4j_uri)


def driver() -> Driver:
    global _driver
    if _driver is None:
        _driver = GraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
        )
        _driver.verify_connectivity()
    return _driver


@contextmanager
def session() -> Iterator[Session]:
    with driver().session(database=settings.neo4j_database or "neo4j") as s:
        yield s


def close() -> None:
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None
