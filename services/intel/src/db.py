"""Postgres access for the intel service."""
from __future__ import annotations

import os
from contextlib import contextmanager

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

_pool: ConnectionPool | None = None
_DSN = os.getenv("POSTGRES_URL", "postgresql://rocketpedia:rocketpedia@localhost:5432/rocketpedia")


def pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(_DSN, min_size=1, max_size=4, open=True)
    return _pool


@contextmanager
def cursor():
    with pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            yield cur


def latest_tles() -> list[dict]:
    """Newest TLE per tracked satellite."""
    with cursor() as cur:
        cur.execute("""
            SELECT DISTINCT ON (s.id) s.id, s.name, s.norad_id, s.cospar_id,
                   ts.tle_line1 AS l1, ts.tle_line2 AS l2
            FROM tle_snapshots ts
            JOIN satellites s ON s.id = ts.satellite_id
            WHERE s.norad_id IS NOT NULL
            ORDER BY s.id, ts.captured_at DESC
        """)
        return cur.fetchall()
