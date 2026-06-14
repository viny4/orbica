"""Full historical seed: Launch Library 2 → Postgres.

Order matters because of foreign keys:
  agencies → rocket_families → rocket_vehicles → launch_sites → launch_events

Each entity is upserted on its LL2 id so the seed is safe to re-run. The
LL2-id → our-UUID maps are kept in memory to resolve foreign keys without
extra round-trips.

Run:  python -m src.seed.historical_seed
"""
from __future__ import annotations

import logging
import os

from src.clients.ll2 import LL2Client
from src.db.pool import cursor, refresh_year_summary, upsert
from src.seed import mappers as m

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("seed")


def _lookup_ll2_to_id(table: str) -> dict[int, str]:
    """Build {ll2_id: uuid} for a table that has an ll2_id column."""
    out: dict[int, str] = {}
    with cursor() as cur:
        cur.execute(f"SELECT id, ll2_id FROM {table} WHERE ll2_id IS NOT NULL")
        for row in cur.fetchall():
            out[row["ll2_id"]] = str(row["id"])
    return out


def seed_agencies(client: LL2Client) -> dict[int, str]:
    log.info("seeding agencies...")
    n = 0
    for a in client.agencies():
        row = m.agency_row(a)
        if row["ll2_id"] is None:
            continue
        # description + founding_year are Wikipedia-enriched where LL2 is null;
        # keep them enricher-owned so a re-sync can't null them back out.
        upsert(
            "agencies", row, conflict="ll2_id",
            update_cols=[k for k in row if k not in ("ll2_id", "description", "founding_year")],
        )
        n += 1
    log.info("agencies upserted: %d", n)
    return _lookup_ll2_to_id("agencies")


def seed_rockets(client: LL2Client, agency_by_ll2: dict[int, str]) -> dict[int, str]:
    log.info("seeding rocket families + vehicles...")
    fam_by_name: dict[str, str] = {}
    n = 0
    for cfg in client.launcher_configs():
        manu_ll2 = (cfg.get("manufacturer") or {}).get("id")
        manufacturer_id = agency_by_ll2.get(manu_ll2)

        fam = m.family_row(cfg, manufacturer_id)
        family_id = None
        if fam:
            if fam["name"] in fam_by_name:
                family_id = fam_by_name[fam["name"]]
            else:
                conflict = "ll2_id" if fam.get("ll2_id") else "name"
                # description + country_code are owned by the Wikipedia/derive
                # enrichers; LL2 usually has them null, so never let a re-sync
                # overwrite enriched values with nulls (set on insert only).
                enricher_owned = {conflict, "description", "country_code"}
                # Families without an LL2 id dedupe on name.
                family_id = upsert(
                    "rocket_families", fam, conflict=conflict,
                    update_cols=[k for k in fam if k not in enricher_owned],
                ) if fam.get("ll2_id") else _upsert_family_by_name(fam)
                fam_by_name[fam["name"]] = family_id

        veh = m.vehicle_row(cfg, family_id)
        if veh["ll2_id"] is None:
            continue
        # `description` is enriched from Wikipedia where LL2 is null — don't let a
        # re-sync clobber it. image_url stays updatable (it's CDN-normalised).
        upsert(
            "rocket_vehicles", veh, conflict="ll2_id",
            update_cols=[k for k in veh if k not in ("ll2_id", "description")],
        )
        n += 1
    log.info("rocket vehicles upserted: %d", n)
    return _lookup_ll2_to_id("rocket_vehicles")


def _upsert_family_by_name(fam: dict) -> str | None:
    # rocket_families has no unique on name; emulate get-or-create.
    with cursor() as cur:
        cur.execute("SELECT id FROM rocket_families WHERE name = %s LIMIT 1", [fam["name"]])
        existing = cur.fetchone()
        if existing:
            return str(existing["id"])
        cols = list(fam.keys())
        cur.execute(
            f"INSERT INTO rocket_families ({', '.join(cols)}) "
            f"VALUES ({', '.join(['%s'] * len(cols))}) RETURNING id",
            [fam[c] for c in cols],
        )
        return str(cur.fetchone()["id"])


def seed_pads(client: LL2Client, agency_by_ll2: dict[int, str]) -> dict[int, str]:
    log.info("seeding launch sites...")
    n = 0
    for pad in client.pads():
        row = m.pad_row(pad, None)
        if row["ll2_id"] is None:
            continue
        upsert(
            "launch_sites", row, conflict="ll2_id",
            update_cols=[k for k in row if k != "ll2_id"],
        )
        n += 1
    log.info("launch sites upserted: %d", n)
    return _lookup_ll2_to_id("launch_sites")


def seed_launches(
    client: LL2Client,
    rocket_by_ll2: dict[int, str],
    agency_by_ll2: dict[int, str],
    site_by_ll2: dict[int, str],
    net_gte: str = "1957-01-01",
) -> None:
    log.info("seeding launches (%s → now)...", net_gte)
    n = 0
    for launch in client.launches(net_gte=net_gte):
        rocket_cfg_id = m.g(launch, "rocket", "configuration", "id")
        agency_id_ll2 = m.g(launch, "launch_service_provider", "id")
        pad_id_ll2 = m.g(launch, "pad", "id")

        row = m.launch_row(
            launch,
            rocket_id=rocket_by_ll2.get(rocket_cfg_id),
            agency_id=agency_by_ll2.get(agency_id_ll2),
            site_id=site_by_ll2.get(pad_id_ll2),
        )
        if row["ll2_uuid"] is None:
            continue
        upsert(
            "launch_events", row, conflict="ll2_uuid",
            update_cols=[k for k in row if k != "ll2_uuid"],
        )
        n += 1
        if n % 500 == 0:
            log.info("  ...%d launches", n)
    log.info("launches upserted: %d", n)


def seed_reference_only() -> None:
    """Seed agencies + rockets + pads from the dev cache (fast, complete, no key)."""
    from src.config import settings

    with LL2Client(base_url=settings.ll2_dev_base_url) as ref:
        agency_by_ll2 = seed_agencies(ref)
        seed_rockets(ref, agency_by_ll2)
        seed_pads(ref, agency_by_ll2)
    log.info("reference seed complete (agencies/rockets/pads).")


def main(
    reference_from_dev: bool = True,
    launches_net_gte: str = "1957-01-01",
    seed_engines: bool = False,
) -> None:
    from src.config import settings

    # Reference data (agencies/rockets/pads) is complete on the dev cache and
    # not rate-limited; launches need the full production history.
    ref_url = settings.ll2_dev_base_url if reference_from_dev else settings.ll2_base_url
    with LL2Client(base_url=ref_url) as ref:
        agency_by_ll2 = seed_agencies(ref)
        rocket_by_ll2 = seed_rockets(ref, agency_by_ll2)
        site_by_ll2 = seed_pads(ref, agency_by_ll2)

    # `launches_net_gte` lets a recurring sync pull only a recent window
    # (recent + upcoming) instead of re-scanning the whole catalogue.
    with LL2Client(base_url=settings.ll2_base_url) as prod:
        seed_launches(prod, rocket_by_ll2, agency_by_ll2, site_by_ll2, net_gte=launches_net_gte)

    # Curated engine catalogue + vehicle mapping. One-time data (doesn't change),
    # so it's only run on a full seed — the recurring cron leaves seed_engines off.
    if seed_engines:
        from src.seed import engines_seed

        log.info("seeding curated engine catalogue...")
        engines_seed.seed()

    log.info("refreshing year_summary materialized view...")
    try:
        refresh_year_summary()
    except Exception as exc:  # first run: non-concurrent refresh needed
        log.warning("concurrent refresh failed (%s); falling back", exc)
        with cursor() as cur:
            cur.execute("REFRESH MATERIALIZED VIEW year_summary")
    log.info("historical seed complete.")


if __name__ == "__main__":
    # Allow `python src/seed/historical_seed.py` as well as `-m`.
    if __package__ in (None, ""):
        import sys

        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    # A full manual seed includes the curated engine catalogue.
    main(seed_engines=True)
