"""Ingest real news articles (SNAPI) and link them to rockets & constellations.

Detail pages then read pre-linked, indexed articles from our own DB — no live
external calls on render.

Run:  python -m src.seed.articles
"""
from __future__ import annotations

import logging

from src.clients.snapi import SnapiClient
from src.db.pool import cursor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("articles")

CONSTELLATIONS = ["Starlink", "OneWeb", "Iridium", "GPS", "Galileo", "Beidou", "Globalstar", "Kuiper"]


def _upsert(cur, a: dict) -> str:
    cur.execute(
        """
        INSERT INTO articles (snapi_id, title, url, summary, image_url, news_site, published_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (snapi_id) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary
        RETURNING id
        """,
        (a["id"], a["title"], a["url"], a.get("summary"), a.get("image_url"),
         a.get("news_site"), a.get("published_at")),
    )
    return str(cur.fetchone()["id"])


def _link(cur, article_id: str, etype: str, ekey: str) -> None:
    cur.execute(
        "INSERT INTO article_links (article_id, entity_type, entity_key) VALUES (%s,%s,%s) "
        "ON CONFLICT DO NOTHING",
        (article_id, etype, ekey),
    )


def _simplify(name: str) -> str:
    # "Falcon 9 Block 5" → "Falcon 9"; drop trailing variant noise for search.
    for cut in (" Block", " v1", " Full Thrust", " (", " FT"):
        name = name.split(cut)[0]
    return name.strip()


def ingest() -> None:
    n_art = n_link = 0
    with SnapiClient() as sn, cursor() as cur:
        cur.execute(
            "SELECT id, name FROM rocket_vehicles WHERE total_launches > 0 "
            "ORDER BY total_launches DESC NULLS LAST LIMIT 40"
        )
        rockets = cur.fetchall()
        for r in rockets:
            try:
                for a in sn.search(_simplify(r["name"]), limit=5):
                    aid = _upsert(cur, a)
                    _link(cur, aid, "rocket", str(r["id"]))
                    n_art += 1
                    n_link += 1
            except Exception as exc:
                log.warning("rocket %s news failed: %s", r["name"], exc)

        for c in CONSTELLATIONS:
            try:
                for a in sn.search(c, limit=8):
                    aid = _upsert(cur, a)
                    _link(cur, aid, "constellation", c)
                    n_link += 1
            except Exception as exc:
                log.warning("constellation %s news failed: %s", c, exc)

        # General latest feed (homepage / fallback).
        try:
            for a in sn.latest(limit=40):
                aid = _upsert(cur, a)
                _link(cur, aid, "latest", "latest")
        except Exception as exc:
            log.warning("latest feed failed: %s", exc)

    log.info("articles ingested (~%d links)", n_link)


if __name__ == "__main__":
    ingest()
