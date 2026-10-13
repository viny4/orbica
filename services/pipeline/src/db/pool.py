"""Postgres access for the pipeline (psycopg3 connection pool + upsert helper)."""
from __future__ import annotations

import atexit
import logging
from contextlib import contextmanager
from typing import Any, Iterable

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from src.config import settings

log = logging.getLogger("db")

_pool: ConnectionPool | None = None


def pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(settings.postgres_url, min_size=1, max_size=8, open=True)
        # Close on exit: otherwise every run ends by waiting ~5s per worker
        # thread ("couldn't stop thread ... within 5.0 seconds").
        atexit.register(_pool.close)
    return _pool


@contextmanager
def cursor():
    with pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            yield cur


def upsert(table: str, row: dict[str, Any], conflict: str, update_cols: Iterable[str], return_inserted: bool = False) -> str | None | tuple[str | None, bool]:
    """Insert `row` into `table`, updating `update_cols` on conflict with `conflict`.

    Returns the row id (UUID as text) when the table has an `id` column.
    If return_inserted is True, returns a tuple (row_id, was_newly_inserted).
    """
    cols = list(row.keys())
    placeholders = ", ".join(["%s"] * len(cols))
    col_list = ", ".join(cols)
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)
    
    if return_inserted:
        sql = (
            f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) "
            f"ON CONFLICT ({conflict}) DO UPDATE SET {updates} "
            f"RETURNING id, (xmax = 0) AS inserted"
        )
    else:
        sql = (
            f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) "
            f"ON CONFLICT ({conflict}) DO UPDATE SET {updates} "
            f"RETURNING id"
        )
        
    with cursor() as cur:
        try:
            cur.execute(sql, [row[c] for c in cols])
            result = cur.fetchone()
            if result:
                id_val = str(result["id"]) if "id" in result else None
                if return_inserted:
                    inserted_val = bool(result.get("inserted", False))
                    return id_val, inserted_val
                return id_val
            return (None, False) if return_inserted else None
        except Exception:
            # Tables without an id (e.g. tle_snapshots) won't RETURN id.
            cur.connection.rollback()
            if return_inserted:
                sql_noret = (
                    f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) "
                    f"ON CONFLICT ({conflict}) DO UPDATE SET {updates} "
                    f"RETURNING (xmax = 0) AS inserted"
                )
                cur.execute(sql_noret, [row[c] for c in cols])
                result = cur.fetchone()
                inserted_val = bool(result.get("inserted", False)) if result else False
                return None, inserted_val
            else:
                sql_noret = (
                    f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) "
                    f"ON CONFLICT ({conflict}) DO UPDATE SET {updates}"
                )
                cur.execute(sql_noret, [row[c] for c in cols])
                return None


_columns_cache: dict[str, set[str]] = {}


def table_columns(table: str) -> set[str]:
    """Columns that exist on `table` in the connected database (cached)."""
    if table not in _columns_cache:
        with cursor() as cur:
            cur.execute(
                "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = %s",
                [table],
            )
            _columns_cache[table] = {r["column_name"] for r in cur.fetchall()}
    return _columns_cache[table]


def upsert_many(
    table: str,
    rows: list[dict[str, Any]],
    conflict: str,
    update_cols: Iterable[str],
    skip_unchanged: bool = True,
) -> list[tuple[str | None, str]]:
    """Batch upsert: one connection, one transaction, statements pipelined.

    Returns, per input row, ``(id, status)`` where status is ``"inserted"``,
    ``"updated"`` or ``"unchanged"``.

    Replaces per-row ``upsert()`` calls in the recurring sync: ~1,500 rows each
    paid their own connection checkout + commit round trips to the database
    (GitHub's US runners → Supabase in Singapore), which made one sync step
    take ~17 minutes.

    ``skip_unchanged`` adds ``WHERE (cols) IS DISTINCT FROM (EXCLUDED.cols)`` so
    rows whose data didn't change aren't rewritten — less WAL/bloat, and the
    "updated" count in sync_logs means something. Needs comparable column types
    (turn it off for tables with geography columns).

    Keys the target table doesn't have (e.g. columns added by a migration that
    hasn't been applied there yet) are dropped rather than failing the sync.
    """
    if not rows:
        return []
    existing = table_columns(table)
    cols = [c for c in rows[0].keys() if c in existing]
    dropped = set(rows[0].keys()) - set(cols)
    if dropped:
        log.info("upsert_many(%s): skipping columns not in this database: %s", table, sorted(dropped))
    upd = [c for c in update_cols if c in cols]

    placeholders = ", ".join(["%s"] * len(cols))
    sql = f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({placeholders}) ON CONFLICT ({conflict}) "
    if upd:
        sql += "DO UPDATE SET " + ", ".join(f"{c} = EXCLUDED.{c}" for c in upd)
        if skip_unchanged:
            sql += (
                f" WHERE ({', '.join(f'{table}.{c}' for c in upd)}) IS DISTINCT FROM "
                f"({', '.join(f'EXCLUDED.{c}' for c in upd)})"
            )
    else:
        sql += "DO NOTHING"
    sql += " RETURNING id, (xmax = 0) AS inserted"

    out: list[tuple[str | None, str]] = []
    with pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.executemany(sql, [[r.get(c) for c in cols] for r in rows], returning=True)
            while True:
                res = cur.fetchone()
                if res is None:
                    out.append((None, "unchanged"))  # update skipped by the WHERE
                else:
                    out.append((str(res["id"]), "inserted" if res["inserted"] else "updated"))
                if not cur.nextset():
                    break
    return out


def refresh_year_summary() -> None:
    with cursor() as cur:
        cur.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY year_summary")

