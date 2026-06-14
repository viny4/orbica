"""Attach a real description, photo and source link (Wikipedia) to notable
satellites — deep-space probes, telescopes, stations, and famous historical
craft. Megaconstellation members (Starlink-N…) are skipped: no per-object article.

Run:  python -m src.seed.enrich_wiki [limit]
"""
from __future__ import annotations

import logging
import sys
import time

from src.clients.wikipedia import WikipediaClient
from src.db.pool import cursor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("wiki")

# Tricky names → exact Wikipedia titles.
OVERRIDE = {
    "CASSINI": "Cassini–Huygens",
    "ISS (ZARYA)": "International Space Station",
    "HST": "Hubble Space Telescope",
    "JWST": "James Webb Space Telescope",
    "TESS": "Transiting Exoplanet Survey Satellite",
    "COBE": "Cosmic Background Explorer",
    "WMAP": "Wilkinson Microwave Anisotropy Probe",
    "IRAS": "IRAS",
    "SOHO": "Solar and Heliospheric Observatory",
    "TIANGONG": "Tiangong space station",
}

FAMOUS = [
    "sputnik%", "explorer 1%", "vanguard%", "skylab%", "mir%", "salyut%", "telstar%",
    "syncom%", "tiros%", "envisat%", "spektr%", "genesis%", "hayabusa%", "rosetta%",
    "philae%", "chang%", "tiangong%", "hubble%", "chandra%", "spitzer%", "kepler%",
    "tess%", "gaia%", "iras%", "wmap%", "cobe%", "planck%", "herschel%", "ulysses%",
    "magellan%", "messenger%", "dawn%", "juno%", "galileo probe%", "viking%", "luna %",
    "ranger%", "surveyor%", "pioneer%", "voyager%", "new horizons%", "soho%",
]


def candidates(limit: int) -> list[dict]:
    with cursor() as cur:
        cur.execute(
            """
            SELECT id, name, image_url, description FROM satellites
            WHERE object_type = 'PAY'
              AND wikipedia_url IS NULL
              AND (
                purpose IN ('Planetary Science','Space Telescope','Human Spaceflight')
                OR name ILIKE ANY(%s)
              )
            ORDER BY launch_date DESC NULLS LAST
            LIMIT %s
            """,
            (FAMOUS, limit),
        )
        return cur.fetchall()


def enrich(limit: int = 1500) -> None:
    rows = candidates(limit)
    log.info("resolving Wikipedia for %d notable satellites", len(rows))
    hit = 0
    with WikipediaClient() as wiki:
        for i, s in enumerate(rows):
            override = OVERRIDE.get((s["name"] or "").upper())
            info = wiki.resolve(s["name"], override)
            if info:
                with cursor() as cur:
                    cur.execute(
                        """
                        UPDATE satellites SET
                            description = %s,
                            image_url = COALESCE(image_url, %s),
                            wikipedia_url = %s,
                            updated_at = NOW()
                        WHERE id = %s
                        """,
                        (info["extract"], info["image"], info["url"], s["id"]),
                    )
                hit += 1
            if (i + 1) % 50 == 0:
                log.info("  %d/%d processed, %d enriched", i + 1, len(rows), hit)
            time.sleep(0.03)  # be polite to Wikipedia
    log.info("wiki enrichment done: %d/%d enriched", hit, len(rows))


if __name__ == "__main__":
    enrich(int(sys.argv[1]) if len(sys.argv) > 1 else 1500)
