"""Fill rocket gaps:
  • rocket_families.country_code  ← derived from the manufacturer agency
  • rocket_families.description   ← Wikipedia
  • rocket_vehicles.description / image_url ← Wikipedia (for the visible detail pages)

Run:  python -m src.seed.enrich_rockets_wiki
"""
from __future__ import annotations

import logging
import time

from src.clients.wikipedia import WikipediaClient, clean_title
from src.db.pool import cursor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("rocketwiki")

# A real rocket article mentions at least one of these — used to reject the
# "Saturn=planet", "Vega=star", "Atlas=myth" type of wrong match.
ROCKET_WORDS = (
    "rocket", "launch vehicle", "launcher", "launch system",
    "expendable launch", "carrier rocket", "missile",
)


def looks_like_rocket(text: str) -> bool:
    t = (text or "").lower()
    return any(w in t for w in ROCKET_WORDS)


def resolve_rocket(wiki: WikipediaClient, name: str) -> dict | None:
    """Disambiguation-first: prefer the explicit "(rocket family)"/"(rocket)"
    page, then a plain title only if it actually reads like a rocket."""
    base = clean_title(name)
    for cand in (f"{base} (rocket family)", f"{base} (rocket)", f"{base} (launch vehicle)"):
        s = wiki.summary(cand)
        if s and looks_like_rocket(s["extract"]):
            return s
    s = wiki.summary(base)
    if s and looks_like_rocket(s["extract"]):
        return s
    hit = wiki._search(f"{base} rocket launch vehicle")
    if hit:
        s = wiki.summary(hit)
        if s and looks_like_rocket(s["extract"]):
            return s
    return None


def derive_family_country() -> int:
    with cursor() as cur:
        cur.execute("""
            UPDATE rocket_families rf SET country_code = a.country_code
            FROM agencies a
            WHERE rf.manufacturer_id = a.id AND a.country_code IS NOT NULL
              AND rf.country_code IS NULL
        """)
        return cur.rowcount


# Selects rows that are empty OR whose description doesn't read like a rocket
# (i.e. the wrong-topic matches we want to fix).
_SUSPECT = "description IS NULL OR description = '' OR description !~* 'rocket|launch vehicle|launcher|launch system|expendable launch|carrier rocket|missile'"


def enrich() -> None:
    n = derive_family_country()
    log.info("families given a country from their manufacturer: %d", n)

    with cursor() as cur:
        cur.execute(f"SELECT id, name FROM rocket_families WHERE {_SUSPECT}")
        families = cur.fetchall()
        cur.execute(f"SELECT id, name, image_url FROM rocket_vehicles WHERE {_SUSPECT}")
        vehicles = cur.fetchall()
    log.info("families to (re)resolve: %d, vehicles: %d", len(families), len(vehicles))

    fam_hit = veh_hit = 0
    with WikipediaClient() as wiki:
        for f in families:
            info = resolve_rocket(wiki, f["name"])
            if info:
                with cursor() as cur:
                    cur.execute("UPDATE rocket_families SET description = %s WHERE id = %s", (info["extract"], f["id"]))
                fam_hit += 1
            time.sleep(0.03)

        for v in vehicles:
            info = resolve_rocket(wiki, v["name"])
            if info:
                with cursor() as cur:
                    cur.execute(
                        "UPDATE rocket_vehicles SET description = %s, image_url = COALESCE(image_url, %s) WHERE id = %s",
                        (info["extract"], info.get("image"), v["id"]),
                    )
                veh_hit += 1
            time.sleep(0.03)

    log.info("rocket wiki fix: families %d/%d, vehicles %d/%d", fam_hit, len(families), veh_hit, len(vehicles))


def backfill_images() -> None:
    """Add a Wikipedia image to rockets that still have none."""
    with cursor() as cur:
        cur.execute("SELECT id, name FROM rocket_vehicles WHERE image_url IS NULL")
        rockets = cur.fetchall()
    log.info("rockets missing an image: %d", len(rockets))
    hit = 0
    with WikipediaClient() as wiki:
        for r in rockets:
            info = resolve_rocket(wiki, r["name"])
            if info and info.get("image"):
                with cursor() as cur:
                    cur.execute("UPDATE rocket_vehicles SET image_url = %s WHERE id = %s", (info["image"], r["id"]))
                hit += 1
            time.sleep(0.03)
    log.info("rocket image backfill: %d/%d filled", hit, len(rockets))


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "images":
        backfill_images()
    else:
        enrich()
