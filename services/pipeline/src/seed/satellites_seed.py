"""Satellite + TLE seed: CelesTrak → Postgres.

Upserts a satellites row per NORAD object and appends a TLE snapshot to the
TimescaleDB hypertable. Run after the historical (launch) seed so satellites can
later be linked to launch_events.

Run:  python -m src.seed.satellites_seed [group]   (default group: active)
"""
from __future__ import annotations

import logging
import sys
from datetime import datetime, timezone

from src.clients.celestrak import CelesTrakClient, TLE
from src.db.pool import cursor, upsert

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("seed.sat")

# CelesTrak groups → our constellation labels (others left null).
CONSTELLATION = {
    "starlink": "Starlink",
    "gps-ops": "GPS",
    "galileo": "Galileo",
    "oneweb": "OneWeb",
    "glo-ops": "GLONASS",
}


def seed_group(group: str = "active") -> None:
    constellation = CONSTELLATION.get(group)
    captured = datetime.now(timezone.utc)
    n = 0
    with CelesTrakClient() as client:
        for tle in client.group(group):
            sat_id = _upsert_satellite(tle, constellation)
            _insert_tle(sat_id, tle, captured)
            n += 1
            if n % 1000 == 0:
                log.info("  ...%d satellites", n)
    log.info("group %s: %d satellites + TLEs upserted", group, n)


def _upsert_satellite(tle: TLE, constellation: str | None) -> str:
    row = {
        "name": tle.name,
        "norad_id": tle.norad_id,
        "constellation": constellation,
        "status": "active",
    }
    sat_id = upsert(
        "satellites", row, conflict="norad_id",
        update_cols=["name", "constellation", "status"],
    )
    if sat_id:
        return sat_id
    # upsert helper returns None only on no-RETURNING path; fetch explicitly.
    with cursor() as cur:
        cur.execute("SELECT id FROM satellites WHERE norad_id = %s", [tle.norad_id])
        return str(cur.fetchone()["id"])


def _insert_tle(sat_id: str, tle: TLE, captured: datetime) -> None:
    with cursor() as cur:
        cur.execute(
            "INSERT INTO tle_snapshots (satellite_id, captured_at, tle_line1, tle_line2, source) "
            "VALUES (%s, %s, %s, %s, %s)",
            [sat_id, captured, tle.line1, tle.line2, "celestrak"],
        )


def link_satellites_to_launches() -> int:
    """Best-effort link satellites.launch_event_id via COSPAR ↔ launch date.

    CelesTrak TLE format doesn't carry COSPAR, so this matches on launch_year
    where a satellite has a populated launch_date but no launch_event yet.
    Refined linking happens once GP-JSON (with OBJECT_ID) ingestion is added.
    """
    with cursor() as cur:
        cur.execute(
            """
            UPDATE satellites s
            SET launch_event_id = le.id
            FROM launch_events le
            WHERE s.launch_event_id IS NULL
              AND s.launch_date IS NOT NULL
              AND le.launch_time::date = s.launch_date
            """
        )
        return cur.rowcount


def main() -> None:
    group = sys.argv[1] if len(sys.argv) > 1 else "active"
    seed_group(group)
    linked = link_satellites_to_launches()
    log.info("linked %d satellites to launches", linked)


if __name__ == "__main__":
    main()
