"""Enrich satellites with Space-Track SATCAT data: decay dates + RCS size class.

One bulk SATCAT download, matched to our catalogue by NORAD id. Fills only NULLs
(so curated/UCS values always win) and is idempotent — safe on every sync.

Run:  python -m src.seed.enrich_spacetrack
"""
from __future__ import annotations

import logging

from src.clients.spacetrack import SpaceTrackClient
from src.db.pool import cursor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("spacetrack-enrich")

# RCS (radar cross-section) size class → an honest physical-size descriptor.
_RCS_LABEL = {
    "SMALL": "Small (RCS < 0.1 m²)",
    "MEDIUM": "Medium (RCS 0.1–1 m²)",
    "LARGE": "Large (RCS > 1 m²)",
}


def _date(s: str | None) -> str | None:
    return s[:10] if s and len(s) >= 10 else None


def enrich() -> dict:
    with SpaceTrackClient() as st:
        rows = st.satcat()

    payload = []
    for r in rows:
        norad = r.get("NORAD_CAT_ID")
        try:
            norad = int(norad)
        except (TypeError, ValueError):
            continue
        decay = _date(r.get("DECAY"))
        dim = _RCS_LABEL.get((r.get("RCS_SIZE") or "").strip().upper())
        if decay or dim:
            payload.append((norad, decay, dim))
    log.info("SATCAT records carrying decay/size: %d", len(payload))

    with cursor() as cur:
        cur.execute("CREATE TEMP TABLE st(norad int PRIMARY KEY, decay date, dim text) ON COMMIT DROP")
        with cur.copy("COPY st(norad, decay, dim) FROM STDIN") as cp:
            for row in payload:
                cp.write_row(row)
        # Fill only what's empty; correct status to 'decayed' when a decay date exists.
        cur.execute(
            """
            UPDATE satellites s SET
              reentry_date = COALESCE(s.reentry_date, st.decay),
              dimensions   = COALESCE(NULLIF(s.dimensions, ''), st.dim),
              status       = CASE WHEN st.decay IS NOT NULL THEN 'decayed' ELSE s.status END
            FROM st
            WHERE s.norad_id = st.norad
              AND (s.reentry_date IS NULL OR s.dimensions IS NULL OR s.dimensions = ''
                   OR (st.decay IS NOT NULL AND s.status <> 'decayed'))
            """
        )
        updated = cur.rowcount
    log.info("space-track enrich: %d satellites updated", updated)
    return {"updated": updated}


if __name__ == "__main__":
    print(enrich())
