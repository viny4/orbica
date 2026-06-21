"""Reentry / decay watch — finds objects sinking toward the atmosphere.

Perigee altitude is computed directly from each object's TLE (semi-major axis +
eccentricity). Low, sinking perigees mean imminent reentry. Below ~120 km an
object cannot maintain orbit; ~180 km gives days, ~300 km gives weeks-months.

Run:  python -m src.reentry
"""
from __future__ import annotations

import logging
import math

from sgp4.api import Satrec

from src.db import cursor, latest_tles

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("reentry")

RE_KM = 6378.137  # Earth equatorial radius


def _est_days(perigee_km: float) -> float:
    """Rough order-of-magnitude days-to-reentry from perigee altitude alone.

    A monotonic drag heuristic (true lifetime also depends on the unknown
    ballistic coefficient + solar activity, so this is deliberately approximate
    and surfaced as "~N days est." in the UI): ~days near 180 km, ~weeks by
    250 km, ~months by 300 km, ~a couple of years approaching 400 km.
    """
    if perigee_km < 180:
        return round(max(0.3, (perigee_km - 110) / 12), 1)
    return round(0.31 * math.exp(perigee_km / 51.8), 1)


def classify(perigee_km: float) -> tuple[str | None, float | None]:
    """status, rough days-to-reentry (clearly an estimate)."""
    if perigee_km < 180:
        return "imminent", _est_days(perigee_km)
    if perigee_km < 300:
        return "decaying", _est_days(perigee_km)
    if perigee_km < 400:
        return "low", _est_days(perigee_km)
    return None, None


def compute() -> int:
    sats = latest_tles()
    log.info("screening %d objects for decay", len(sats))
    rows = []
    for s in sats:
        try:
            sat = Satrec.twoline2rv(s["l1"], s["l2"])
        except Exception:
            continue
        a_km = sat.a * RE_KM  # semi-major axis (sat.a is in Earth radii)
        e = sat.ecco
        perigee = a_km * (1 - e) - RE_KM
        apogee = a_km * (1 + e) - RE_KM
        if perigee <= 0 or perigee > 400:
            continue
        status, est = classify(perigee)
        if status is None:
            continue
        rows.append((s["id"], s["name"], round(perigee, 2), round(apogee, 2), status, est))

    with cursor() as cur:
        cur.execute("TRUNCATE reentries")
        cur.executemany(
            "INSERT INTO reentries (satellite_id, name, perigee_km, apogee_km, status, est_days, computed_at) "
            "VALUES (%s,%s,%s,%s,%s,%s, NOW()) ON CONFLICT (satellite_id) DO NOTHING",
            rows,
        )
        # surface the imminent ones as events
        cur.execute("DELETE FROM space_events WHERE kind = 'reentry'")
        cur.execute("""
            INSERT INTO space_events (kind, title, detail, occurred_at, href)
            SELECT 'reentry', name || ' is reentering',
                   'Perigee '||perigee_km||' km — '||status, NOW(),
                   '/intel/reentry'
            FROM reentries WHERE status = 'imminent'
            ON CONFLICT DO NOTHING
        """)
    log.info("reentry watch: %d decaying objects (%d imminent)",
             len(rows), sum(1 for r in rows if r[4] == "imminent"))
    return len(rows)


if __name__ == "__main__":
    compute()
