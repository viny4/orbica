"""Postgres access for the pipeline (psycopg3 connection pool + upsert helper)."""
from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterable

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from src.config import settings

_pool: ConnectionPool | None = None


def pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(settings.postgres_url, min_size=1, max_size=8, open=True)
    return _pool


@contextmanager
def cursor():
    with pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            yield cur


def upsert(table: str, row: dict[str, Any], conflict: str, update_cols: Iterable[str]) -> str | None:
    """Insert `row` into `table`, updating `update_cols` on conflict with `conflict`.

    Returns the row id (UUID as text) when the table has an `id` column.
    """
    cols = list(row.keys())
    placeholders = ", ".join(["%s"] * len(cols))
    col_list = ", ".join(cols)
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)
    sql = (
        f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) "
        f"ON CONFLICT ({conflict}) DO UPDATE SET {updates} "
        f"RETURNING id"
    )
    with cursor() as cur:
        try:
            cur.execute(sql, [row[c] for c in cols])
            result = cur.fetchone()
            return str(result["id"]) if result and "id" in result else None
        except Exception:
            # Tables without an id (e.g. tle_snapshots) won't RETURN id.
            cur.connection.rollback()
            sql_noret = (
                f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) "
                f"ON CONFLICT ({conflict}) DO UPDATE SET {updates}"
            )
            cur.execute(sql_noret, [row[c] for c in cols])
            return None


def refresh_year_summary() -> None:
    with cursor() as cur:
        cur.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY year_summary")
