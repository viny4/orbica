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
from typing import Any

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


def seed_agencies(client: LL2Client) -> tuple[dict[int, str], int, int, dict]:
    log.info("seeding agencies...")
    added_names = []
    updated_names = []
    for a in client.agencies():
        row = m.agency_row(a)
        if row["ll2_id"] is None:
            continue
        # description + founding_year are Wikipedia-enriched where LL2 is null;
        # keep them enricher-owned so a re-sync can't null them back out.
        res = upsert(
            "agencies", row, conflict="ll2_id",
            update_cols=[k for k in row if k not in ("ll2_id", "description", "founding_year")],
            return_inserted=True,
        )
        _, inserted = res if isinstance(res, tuple) else (res, False)
        if inserted:
            added_names.append(row["name"])
        else:
            updated_names.append(row["name"])
    log.info("agencies upserted: added %d, updated %d", len(added_names), len(updated_names))
    return _lookup_ll2_to_id("agencies"), len(added_names), len(updated_names), {"added_items": added_names, "updated_items": updated_names}


def seed_rockets(client: LL2Client, agency_by_ll2: dict[int, str]) -> tuple[dict[int, str], int, int, dict]:
    log.info("seeding rocket families + vehicles...")
    fam_by_name: dict[str, str] = {}
    added_names = []
    updated_names = []
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
                if fam.get("ll2_id"):
                    res = upsert(
                        "rocket_families", fam, conflict=conflict,
                        update_cols=[k for k in fam if k not in enricher_owned],
                        return_inserted=True,
                    )
                    family_id, _ = res if isinstance(res, tuple) else (res, False)
                else:
                    family_id = _upsert_family_by_name(fam)
                fam_by_name[fam["name"]] = family_id

        veh = m.vehicle_row(cfg, family_id)
        if veh["ll2_id"] is None:
            continue
        # `description` is enriched from Wikipedia where LL2 is null — don't let a
        # re-sync clobber it. image_url stays updatable (it's CDN-normalised).
        res = upsert(
            "rocket_vehicles", veh, conflict="ll2_id",
            update_cols=[k for k in veh if k not in ("ll2_id", "description")],
            return_inserted=True,
        )
        _, inserted = res if isinstance(res, tuple) else (res, False)
        if inserted:
            added_names.append(veh["name"])
        else:
            updated_names.append(veh["name"])
    log.info("rocket vehicles upserted: added %d, updated %d", len(added_names), len(updated_names))
    return _lookup_ll2_to_id("rocket_vehicles"), len(added_names), len(updated_names), {"added_items": added_names, "updated_items": updated_names}


def derive_pad_operators() -> int:
    """Set each launch site's operator to the agency that launches there most.
    LL2 doesn't carry this; only fills NULLs so it's idempotent + cron-safe."""
    with cursor() as cur:
        cur.execute(
            """
            UPDATE launch_sites ls SET operator_id = sub.agency_id
            FROM (
              SELECT launch_site_id, agency_id,
                     ROW_NUMBER() OVER (PARTITION BY launch_site_id ORDER BY COUNT(*) DESC) AS rn
              FROM launch_events
              WHERE launch_site_id IS NOT NULL AND agency_id IS NOT NULL
              GROUP BY launch_site_id, agency_id
            ) sub
            WHERE ls.id = sub.launch_site_id AND sub.rn = 1 AND ls.operator_id IS NULL
            """
        )
        return cur.rowcount


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


def seed_pads(client: LL2Client, agency_by_ll2: dict[int, str]) -> tuple[dict[int, str], int, int, dict]:
    log.info("seeding launch sites...")
    added_names = []
    updated_names = []
    for pad in client.pads():
        row = m.pad_row(pad, None)
        if row["ll2_id"] is None:
            continue
        # operator_id is derived (from the agency that launches there most), not
        # carried by LL2 — keep it out of the update so a re-sync can't null it.
        res = upsert(
            "launch_sites", row, conflict="ll2_id",
            update_cols=[k for k in row if k not in ("ll2_id", "operator_id")],
            return_inserted=True,
        )
        _, inserted = res if isinstance(res, tuple) else (res, False)
        if inserted:
            added_names.append(row["name"])
        else:
            updated_names.append(row["name"])
    log.info("launch sites upserted: added %d, updated %d", len(added_names), len(updated_names))
    return _lookup_ll2_to_id("launch_sites"), len(added_names), len(updated_names), {"added_items": added_names, "updated_items": updated_names}


def seed_launches(
    client: LL2Client,
    rocket_by_ll2: dict[int, str],
    agency_by_ll2: dict[int, str],
    site_by_ll2: dict[int, str],
    net_gte: str = "1957-01-01",
) -> tuple[int, int, dict]:
    log.info("seeding launches (%s → now)...", net_gte)
    added_names = []
    updated_names = []
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
        res = upsert(
            "launch_events", row, conflict="ll2_uuid",
            update_cols=[k for k in row if k != "ll2_uuid"],
            return_inserted=True,
        )
        _, inserted = res if isinstance(res, tuple) else (res, False)
        if inserted:
            added_names.append(row["name"])
        else:
            updated_names.append(row["name"])
        if (len(added_names) + len(updated_names)) % 500 == 0:
            log.info("  ...%d launches", (len(added_names) + len(updated_names)))
    log.info("launches upserted: added %d, updated %d", len(added_names), len(updated_names))
    return len(added_names), len(updated_names), {"added_items": added_names, "updated_items": updated_names}


def seed_reference_only() -> None:
    """Seed agencies + rockets + pads from the dev cache (fast, complete, no key)."""
    from src.config import settings

    with LL2Client(base_url=settings.ll2_dev_base_url) as ref:
        agency_by_ll2, _, _, _ = seed_agencies(ref)
        seed_rockets(ref, agency_by_ll2)
        seed_pads(ref, agency_by_ll2)
    log.info("reference seed complete (agencies/rockets/pads).")


def main(
    reference_from_dev: bool = True,
    launches_net_gte: str = "1957-01-01",
    seed_engines: bool = False,
) -> dict[str, Any]:
    from src.config import settings

    stats = {
        "agencies": {"added": 0, "updated": 0, "details": {}},
        "rockets": {"added": 0, "updated": 0, "details": {}},
        "launch_sites": {"added": 0, "updated": 0, "details": {}},
        "launches": {"added": 0, "updated": 0, "details": {}},
    }

    # Reference data (agencies/rockets/pads) is complete on the dev cache and
    # not rate-limited; launches need the full production history.
    ref_url = settings.ll2_dev_base_url if reference_from_dev else settings.ll2_base_url
    with LL2Client(base_url=ref_url) as ref:
        agency_by_ll2, ag_add, ag_upd, ag_det = seed_agencies(ref)
        stats["agencies"] = {"added": ag_add, "updated": ag_upd, "details": ag_det}
        
        rocket_by_ll2, r_add, r_upd, r_det = seed_rockets(ref, agency_by_ll2)
        stats["rockets"] = {"added": r_add, "updated": r_upd, "details": r_det}
        
        site_by_ll2, s_add, s_upd, s_det = seed_pads(ref, agency_by_ll2)
        stats["launch_sites"] = {"added": s_add, "updated": s_upd, "details": s_det}

    # `launches_net_gte` lets a recurring sync pull only a recent window
    # (recent + upcoming) instead of re-scanning the whole catalogue.
    with LL2Client(base_url=settings.ll2_base_url) as prod:
        l_add, l_upd, l_det = seed_launches(prod, rocket_by_ll2, agency_by_ll2, site_by_ll2, net_gte=launches_net_gte)
        stats["launches"] = {"added": l_add, "updated": l_upd, "details": l_det}

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
    
    return stats


if __name__ == "__main__":
    # Allow `python src/seed/historical_seed.py` as well as `-m`.
    if __package__ in (None, ""):
        import sys

        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    # A full manual seed includes the curated engine catalogue.
    main(seed_engines=True)
