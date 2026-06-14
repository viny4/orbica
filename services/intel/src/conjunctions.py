"""Conjunction screening — finds objects that pass dangerously close.

Propagates the entire TLE catalogue across a time grid with sgp4's vectorised
SatrecArray, then at each step uses a KD-tree to find pairs within a screening
threshold, keeping each pair's closest approach (TCA + miss distance + relative
speed). This is a coarse screen (sampled, not refined to the exact TCA), which is
exactly how operational catalogs pre-filter before precise analysis.

Run:  python -m src.conjunctions
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import numpy as np
from scipy.spatial import cKDTree
from sgp4.api import Satrec, SatrecArray, jday

from src.db import cursor, latest_tles

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("conjunctions")

HORIZON_HOURS = 3
STEP_SECONDS = 30
THRESHOLD_KM = 10.0   # screening distance
MIN_REL_KMS = 0.5     # below this the pair is docked/co-flying, not a real crossing
KEEP = 80             # store the closest N


def _launch(cospar: str | None) -> str | None:
    return cospar[:8] if cospar else None  # YYYY-NNN launch designator


def compute() -> int:
    sats = latest_tles()
    satrecs, meta = [], []
    for s in sats:
        try:
            satrecs.append(Satrec.twoline2rv(s["l1"], s["l2"]))
            meta.append(s)
        except Exception:
            continue
    log.info("propagating %d objects over %dh @ %ds steps", len(satrecs), HORIZON_HOURS, STEP_SECONDS)

    base = datetime.now(timezone.utc)
    n = int(HORIZON_HOURS * 3600 / STEP_SECONDS)
    times = [base + timedelta(seconds=STEP_SECONDS * i) for i in range(n)]
    jd = np.empty(n)
    fr = np.empty(n)
    for i, t in enumerate(times):
        jd[i], fr[i] = jday(t.year, t.month, t.day, t.hour, t.minute, t.second + t.microsecond * 1e-6)

    arr = SatrecArray(satrecs)
    e, r, v = arr.sgp4(jd, fr)   # r,v: (M, N, 3) km / km·s in TEME

    launches = [_launch(m.get("cospar_id")) for m in meta]

    best: dict[tuple[int, int], tuple[float, int, float]] = {}
    for ti in range(n):
        ok = e[:, ti] == 0
        idx = np.nonzero(ok)[0]
        if idx.size < 2:
            continue
        pos = r[idx, ti, :]
        tree = cKDTree(pos)
        for i, j in tree.query_pairs(THRESHOLD_KM):
            a, b = int(idx[i]), int(idx[j])
            # Skip co-deployed objects (same launch) — intentional formations.
            if launches[a] and launches[a] == launches[b]:
                continue
            rel = float(np.linalg.norm(v[a, ti, :] - v[b, ti, :]))
            if rel < MIN_REL_KMS:  # docked / co-flying, not a crossing
                continue
            d = float(np.linalg.norm(pos[i] - pos[j]))
            key = (a, b) if a < b else (b, a)
            if key not in best or d < best[key][0]:
                best[key] = (d, ti, rel)

    ranked = sorted(best.items(), key=lambda kv: kv[1][0])[:KEEP]
    rows = []
    for (a, b), (d, ti, rel) in ranked:
        rows.append((
            meta[a]["id"], meta[b]["id"], meta[a]["name"], meta[b]["name"],
            times[ti], round(d, 3), round(rel, 3),
        ))

    with cursor() as cur:
        cur.execute("TRUNCATE conjunctions")
        cur.executemany(
            "INSERT INTO conjunctions (sat_a_id, sat_b_id, sat_a_name, sat_b_name, tca, miss_km, rel_speed_kms, computed_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s, NOW())",
            rows,
        )
        cur.execute("DELETE FROM space_events WHERE kind = 'conjunction'")
        cur.execute("""
            INSERT INTO space_events (kind, title, detail, occurred_at, href)
            SELECT 'conjunction', sat_a_name||' ⇄ '||sat_b_name,
                   'Closest approach '||miss_km||' km at '||round(rel_speed_kms)||' km/s', tca, '/intel/conjunctions'
            FROM conjunctions WHERE miss_km < 1.0 ORDER BY miss_km LIMIT 10
            ON CONFLICT DO NOTHING
        """)
    log.info("conjunctions: %d screened pairs, closest %.3f km", len(rows), rows[0][5] if rows else -1)
    return len(rows)


if __name__ == "__main__":
    compute()
