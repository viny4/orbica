"""Enrich satellites with ESA DISCOS data: real measured mass + dimensions + shape.

DISCOS is the authoritative physical-characteristics source, so its values take
precedence over our constellation/RCS estimates (COALESCE(discos, existing)).
Matched by NORAD (satno). Idempotent — safe on every sync.

Run:  python -m src.seed.enrich_discos
"""
from __future__ import annotations

import logging

from src.clients.discos import DiscosClient
from src.db.pool import cursor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("discos-enrich")


def _g(x: float | None) -> str | None:
    return f"{x:g}" if x else None


def _dims(a: dict) -> str | None:
    """A readable physical-dimensions string from whatever DISCOS provides."""
    h, w, d = _g(a.get("height")), _g(a.get("width")), _g(a.get("depth"))
    dia, span = _g(a.get("diameter")), _g(a.get("span"))
    if h and w and d:
        return f"{h} × {w} × {d} m"
    if dia and (h or span):
        return f"Ø{dia} × {h or span} m"   # Ø<dia> × <len> m
    if dia:
        return f"Ø{dia} m"
    if span:
        return f"{span} m span"
    return None


def enrich() -> dict:
    rows = []
    with DiscosClient() as d:
        for o in d.objects_with_mass():
            a = o.get("attributes", {})
            satno = a.get("satno")
            if satno is None:
                continue
            try:
                rows.append((int(satno), a.get("mass"), _dims(a), int(o["id"])))
            except (TypeError, ValueError):
                continue
    log.info("DISCOS objects with mass: %d", len(rows))

    with cursor() as cur:
        cur.execute("CREATE TEMP TABLE dc(norad int PRIMARY KEY, mass numeric, dim text, discos int) ON COMMIT DROP")
        with cur.copy("COPY dc(norad, mass, dim, discos) FROM STDIN") as cp:
            for row in rows:
                cp.write_row(row)
        # DISCOS wins where it has a value; existing data kept otherwise.
        cur.execute(
            """
            UPDATE satellites s SET
              mass_kg    = COALESCE(dc.mass, s.mass_kg),
              dimensions = COALESCE(dc.dim, s.dimensions),
              discos_id  = dc.discos
            FROM dc WHERE s.norad_id = dc.norad
        """
        )
        updated = cur.rowcount
    log.info("DISCOS enrich: %d satellites updated", updated)
    return {"updated": updated}


if __name__ == "__main__":
    print(enrich())
