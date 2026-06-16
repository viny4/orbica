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
    
    with CelesTrakClient() as client:
        tles = list(client.group(group))
        
    log.info("fetched %d TLEs for group %s. Bulk upserting satellites...", len(tles), group)
    
    if not tles:
        return
        
    sat_rows = [
        (tle.name, tle.norad_id, constellation, "active")
        for tle in tles
    ]
    
    with cursor() as cur:
        cur.executemany(
            """
            INSERT INTO satellites (name, norad_id, constellation, status)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (norad_id) DO UPDATE SET
              name = EXCLUDED.name,
              constellation = EXCLUDED.constellation,
              status = EXCLUDED.status
            """,
            sat_rows
        )
        
        norad_ids = [tle.norad_id for tle in tles]
        cur.execute(
            "SELECT id, norad_id FROM satellites WHERE norad_id = ANY(%s)",
            [norad_ids]
        )
        id_map = {row["norad_id"]: str(row["id"]) for row in cur.fetchall()}
        
        tle_rows = [
            (id_map[tle.norad_id], captured, tle.line1, tle.line2, "celestrak")
            for tle in tles
            if tle.norad_id in id_map
        ]
        
        log.info("bulk inserting %d TLE snapshots...", len(tle_rows))
        cur.executemany(
            """
            INSERT INTO tle_snapshots (satellite_id, captured_at, tle_line1, tle_line2, source)
            VALUES (%s, %s, %s, %s, %s)
            """,
            tle_rows
        )
        
    log.info("group %s: %d satellites + TLEs upserted", group, len(tles))


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


# Published per-satellite spec by constellation — operator, a typical mass (kg)
# and approximate bus dimensions. Used to fill rows the catalogue (CelesTrak)
# can't, so the ever-growing Starlink/OneWeb fleets stay populated on every sync.
_CONSTELLATION_SPECS = {
    "Starlink": ("SpaceX", 295, "~2.8 × 1.4 m bus"),
    "OneWeb": ("OneWeb", 150, "~1.0 × 1.0 × 1.3 m"),
    "Iridium": ("Iridium Communications", 860, "~3.1 × 2.4 × 1.5 m"),
    "Globalstar": ("Globalstar", 700, "~1.9 × 1.8 m"),
    "GPS": ("U.S. Space Force", 2000, "~2.5 × 2.0 × 2.0 m"),
    "Galileo": ("European Union (EUSPA)", 700, "~2.7 × 1.2 × 1.1 m"),
    "Beidou": ("China (CNSA)", 1000, "~2.2 × 1.8 × 1.5 m"),
    "OrbComm": ("ORBCOMM", 172, "~1.1 m hexagonal"),
    "Kuiper": ("Amazon (Project Kuiper)", 500, "~3.0 m class"),
}


def derive_constellation_specs() -> int:
    """Fill operator_name + mass + dimensions for constellation members the
    catalogue omits. Only touches NULLs, so curated/UCS values always win.
    Idempotent."""
    total = 0
    with cursor() as cur:
        for name, (operator, mass, dims) in _CONSTELLATION_SPECS.items():
            cur.execute(
                """
                UPDATE satellites SET
                  operator_name = COALESCE(NULLIF(operator_name, ''), %s),
                  mass_kg       = COALESCE(mass_kg, %s),
                  dimensions    = COALESCE(NULLIF(dimensions, ''), %s)
                WHERE constellation = %s
                  AND (operator_name IS NULL OR operator_name = ''
                       OR mass_kg IS NULL OR dimensions IS NULL OR dimensions = '')
                """,
                (operator, mass, dims, name),
            )
            total += cur.rowcount
    return total


def main() -> None:
    group = sys.argv[1] if len(sys.argv) > 1 else "active"
    seed_group(group)
    linked = link_satellites_to_launches()
    log.info("linked %d satellites to launches", linked)


if __name__ == "__main__":
    main()
