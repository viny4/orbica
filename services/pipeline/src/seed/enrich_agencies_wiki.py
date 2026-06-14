"""Backfill agency descriptions (and a founding year where stated) from Wikipedia
for agencies LL2 left blank.

Run:  python -m src.seed.enrich_agencies_wiki
"""
from __future__ import annotations

import logging
import re
import time

from src.clients.wikipedia import WikipediaClient
from src.db.pool import cursor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("agencywiki")

_FOUNDED = re.compile(r"(?:founded|established|formed|created)(?:[^.]*?)\b((?:1[89]|20)\d{2})\b", re.I)


def enrich() -> None:
    with cursor() as cur:
        cur.execute("SELECT id, name, founding_year FROM agencies WHERE description IS NULL OR description = ''")
        rows = cur.fetchall()
    log.info("agencies needing a description: %d", len(rows))

    hit = 0
    with WikipediaClient() as wiki:
        for i, a in enumerate(rows):
            info = wiki.resolve(a["name"])
            if info and info.get("extract"):
                year = a["founding_year"]
                if not year:
                    m = _FOUNDED.search(info["extract"])
                    if m:
                        year = int(m.group(1))
                with cursor() as cur:
                    cur.execute(
                        "UPDATE agencies SET description = %s, founding_year = COALESCE(founding_year, %s), updated_at = NOW() WHERE id = %s",
                        (info["extract"], year, a["id"]),
                    )
                hit += 1
            if (i + 1) % 25 == 0:
                log.info("  %d/%d, %d enriched", i + 1, len(rows), hit)
            time.sleep(0.03)
    log.info("agency wiki backfill: %d/%d enriched", hit, len(rows))


if __name__ == "__main__":
    enrich()
