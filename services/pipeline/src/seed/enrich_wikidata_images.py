"""Fill missing satellite photos from Wikidata (NORAD id → Commons image).

Only 2.7% of the catalogue ships with an image, and Wikidata holds a NORAD
number next to a photo for ~1.9k satellites. One SPARQL request gets the whole
mapping; a temp table joins it to our catalogue by NORAD id.

Fills only empty image_url (never overwrites a curated/Wikipedia photo), so
it's idempotent and safe on every sync.

Run:  python -m src.seed.enrich_wikidata_images
"""
from __future__ import annotations

import logging

from src.clients.wikidata import WikidataClient
from src.db.pool import cursor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("wikidata-images")


def enrich() -> dict:
    with WikidataClient() as wd:
        images = wd.satellite_images()
    if not images:
        log.warning("Wikidata returned no NORAD→image pairs; nothing to do")
        return {"updated": 0, "details": {"candidates": 0}}

    with cursor() as cur:
        cur.execute("CREATE TEMP TABLE wd_img(norad int PRIMARY KEY, img text) ON COMMIT DROP")
        with cur.copy("COPY wd_img(norad, img) FROM STDIN") as cp:
            for norad, img in images.items():
                cp.write_row((norad, img))
        cur.execute(
            """
            UPDATE satellites s SET
              image_url  = wd_img.img,
              updated_at = NOW()
            FROM wd_img
            WHERE s.norad_id = wd_img.norad
              AND (s.image_url IS NULL OR s.image_url = '')
            """
        )
        updated = cur.rowcount

    log.info("wikidata images: %d pairs fetched, %d satellites filled", len(images), updated)
    return {"updated": updated, "details": {"candidates": len(images)}}


if __name__ == "__main__":
    print(enrich())
