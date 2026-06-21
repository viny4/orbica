"""Fill satellite columns that are derivable from data we already hold — no
external API needed. All steps touch only NULLs (idempotent, cron-safe):

  operator_name        ← owner_code via satcat_owners
  constellation        ← well-known name patterns (Flock, Lemur, O3b, …)
  contractor/users/
  expected_lifetime/
  purpose_detail       ← per-constellation specs
  description          ← generated factual sentence from the sat's own fields

Run:  python -m src.seed.enrich_derived
"""
from __future__ import annotations

import logging

from src.db.pool import cursor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("derived")

# name-prefix → constellation (only well-defined constellations; NOT generic
# designations like "Cosmos" which span many unrelated satellites).
_CONSTELLATION_BY_NAME = {
    "FLOCK": "Flock", "DOVE": "Flock", "SKYSAT": "SkySat",
    "LEMUR": "Lemur", "O3B": "O3b", "YAOGAN": "Yaogan", "GONETS": "Gonets",
}

# constellation → (contractor, users, expected_lifetime_years, purpose_detail)
_CONSTELLATION_DETAIL = {
    "Starlink": ("SpaceX", "Commercial", 5, "Broadband internet"),
    "OneWeb": ("Airbus OneWeb Satellites", "Commercial", 7, "Broadband internet"),
    "Kuiper": ("Amazon", "Commercial", 7, "Broadband internet"),
    "Iridium": ("Thales Alenia Space", "Commercial", 15, "Voice & data communications"),
    "Globalstar": ("Thales Alenia Space", "Commercial", 15, "Satellite phone & data"),
    "GPS": ("Lockheed Martin", "Government/Military", 15, "Navigation"),
    "Galileo": ("OHB / SSTL", "Government", 12, "Navigation"),
    "Beidou": ("CAST", "Government/Military", 12, "Navigation"),
    "OrbComm": ("Sierra Nevada", "Commercial", 10, "Machine-to-machine messaging"),
    "Flock": ("Planet Labs", "Commercial", 3, "Earth imaging"),
    "SkySat": ("Planet Labs", "Commercial", 6, "High-resolution Earth imaging"),
    "Lemur": ("Spire Global", "Commercial", 3, "Weather, ship & aircraft tracking"),
    "O3b": ("SES", "Commercial", 10, "Broadband communications"),
    "Yaogan": ("CAST", "Government/Military", 8, "Reconnaissance"),
    "Gonets": ("ISS Reshetnev", "Commercial", 5, "Store-and-forward messaging"),
}


def enrich() -> dict:
    total = 0
    with cursor() as cur:
        # 1) operator_name from the owner-code lookup
        cur.execute(
            """
            UPDATE satellites s SET operator_name = o.name
            FROM satcat_owners o
            WHERE o.code = s.owner_code AND (s.operator_name IS NULL OR s.operator_name = '')
            """
        )
        log.info("operator_name   filled %d", cur.rowcount)
        total += cur.rowcount

        # 2) constellation from name patterns
        for prefix, name in _CONSTELLATION_BY_NAME.items():
            cur.execute(
                "UPDATE satellites SET constellation = %s "
                "WHERE name ILIKE %s AND (constellation IS NULL OR constellation = '')",
                (name, prefix + "%"),
            )
            total += cur.rowcount

        # 3) per-constellation contractor / users / lifetime / purpose_detail
        for con, (contractor, users, life, detail) in _CONSTELLATION_DETAIL.items():
            cur.execute(
                """
                UPDATE satellites SET
                  contractor              = COALESCE(NULLIF(contractor, ''), %s),
                  users                   = COALESCE(NULLIF(users, ''), %s),
                  expected_lifetime_years = COALESCE(expected_lifetime_years, %s),
                  purpose_detail          = COALESCE(NULLIF(purpose_detail, ''), %s)
                WHERE constellation = %s
                  AND (contractor IS NULL OR users IS NULL
                       OR expected_lifetime_years IS NULL OR purpose_detail IS NULL)
                """,
                (contractor, users, life, detail, con),
            )
            total += cur.rowcount

        # 4) a factual generated description from the satellite's own fields
        cur.execute(
            """
            UPDATE satellites SET description =
              name
              || ' is a '
              || COALESCE(operator_name || ' ', '')
              || CASE
                   WHEN object_type = 'ROCKET BODY' THEN 'rocket body'
                   WHEN object_type = 'DEBRIS' THEN 'piece of catalogued debris'
                   WHEN purpose IS NOT NULL AND purpose <> '' THEN lower(purpose) || ' satellite'
                   ELSE 'spacecraft'
                 END
              || CASE WHEN constellation IS NOT NULL AND constellation <> ''
                      THEN ', part of the ' || constellation || ' constellation' ELSE '' END
              || CASE WHEN launch_date IS NOT NULL
                      THEN ', launched on ' || to_char(launch_date, 'FMMonth FMDD, YYYY') ELSE '' END
              || CASE WHEN orbit_type IS NOT NULL AND orbit_type <> ''
                      THEN ' into ' || orbit_type ELSE '' END
              || CASE WHEN status = 'decayed' THEN '. It has since re-entered the atmosphere.' ELSE '.' END
            WHERE description IS NULL OR description = ''
            """
        )
        log.info("description     filled %d", cur.rowcount)
        total += cur.rowcount

    return {"updated": total}


if __name__ == "__main__":
    print(enrich())
