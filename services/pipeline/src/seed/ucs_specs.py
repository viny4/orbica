"""Fill spacecraft physical/operational specs from the UCS Satellite Database.

SATCAT gives position/catalogue data but no mass, power, lifetime, operator, or
manufacturer. The Union of Concerned Scientists database (free, ~7,560 satellites
through May 2023) provides exactly those, joinable by NORAD id.

Fills: mass_kg, dry_mass_kg, power_watts, expected_lifetime_years, purpose_detail,
operator_name, contractor, users — then links operator_name → agencies.

Run:  python -m src.seed.ucs_specs
"""
from __future__ import annotations

import csv
import io
import logging
import os

import httpx

from src.db.pool import cursor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("ucs")

UCS_URL = "https://www.ucsusa.org/media/11493"  # tab-delimited, common names
CACHE = "/tmp/ucs.tab"


def _num(v: str) -> float | None:
    v = (v or "").strip().replace(",", "")
    if not v:
        return None
    try:
        return float(v)
    except ValueError:
        return None


def _rows() -> list[dict]:
    if os.path.exists(CACHE) and os.path.getsize(CACHE) > 100_000:
        text = open(CACHE, encoding="latin-1", newline="").read()
    else:
        r = httpx.get(UCS_URL, timeout=60.0, follow_redirects=True)
        r.raise_for_status()
        text = r.content.decode("latin-1")
        open(CACHE, "w", encoding="latin-1").write(text)
    return list(csv.DictReader(io.StringIO(text), delimiter="\t"))


def ingest() -> int:
    rows = _rows()
    log.info("UCS rows: %d", len(rows))
    # Exact header → key map (stripped, lower-cased) to avoid "Country of Operator".
    keymap = {(h or "").strip().lower(): h for h in rows[0].keys()}

    def g(r: dict, exact: str) -> str:
        return (r.get(keymap.get(exact, ""), "") or "").strip()

    out = []
    for r in rows:
        norad = g(r, "norad number")
        if not norad.isdigit():
            continue
        power = _num(g(r, "power (watts)"))
        out.append((
            int(norad),
            _num(g(r, "launch mass (kg.)")),
            _num(g(r, "dry mass (kg.)")),
            round(power) if power is not None else None,
            _num(g(r, "expected lifetime (yrs.)")),
            g(r, "detailed purpose") or None,
            g(r, "operator/owner") or None,
            g(r, "contractor") or None,
            g(r, "users") or None,
        ))
    log.info("parsed %d UCS satellites with NORAD ids", len(out))

    with cursor() as cur:
        cur.execute("""
            CREATE TEMP TABLE ucs(
                norad int, mass numeric, dry numeric, power int, life numeric,
                detail text, op text, contractor text, users text
            ) ON COMMIT DROP
        """)
        with cur.copy("COPY ucs (norad,mass,dry,power,life,detail,op,contractor,users) FROM STDIN") as cp:
            for row in out:
                cp.write_row(row)

        cur.execute("""
            UPDATE satellites s SET
                mass_kg = COALESCE(u.mass, s.mass_kg),
                dry_mass_kg = COALESCE(u.dry, s.dry_mass_kg),
                power_watts = COALESCE(u.power, s.power_watts),
                expected_lifetime_years = COALESCE(u.life, s.expected_lifetime_years),
                purpose_detail = COALESCE(NULLIF(u.detail, ''), s.purpose_detail),
                operator_name = COALESCE(u.op, s.operator_name),
                contractor = COALESCE(u.contractor, s.contractor),
                users = COALESCE(u.users, s.users)
            FROM ucs u WHERE s.norad_id = u.norad
        """)
        updated = cur.rowcount

        # Best-effort: resolve operator_name → an agency for the FK link.
        cur.execute("""
            UPDATE satellites s SET operator_id = a.id
            FROM agencies a
            WHERE s.operator_id IS NULL AND s.operator_name IS NOT NULL
              AND (a.name ILIKE s.operator_name OR a.abbrev ILIKE s.operator_name)
        """)
        linked = cur.rowcount

    log.info("UCS: %d satellites enriched, %d linked to an operator agency", updated, linked)
    return updated


if __name__ == "__main__":
    ingest()
