"""Derive rocket_vehicles spec columns from data we already hold — the engine
catalogue (rocket_engines + engines) and the launch history (launch_events).

These are honest derivations, not guesses: propellants/Isp/thrust come straight
from the mapped engines, last_flight from the actual launches. Fills only NULLs,
so it's idempotent and safe on every sync.

Run:  python -m src.seed.enrich_rocket_specs
"""
from __future__ import annotations

import logging

from src.db.pool import cursor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("rocket-specs")

# (label, SQL). Each only touches NULLs.
_STEPS: list[tuple[str, str]] = [
    # first_flight: the vehicle's maiden (earliest) launch
    ("first_flight", """
        UPDATE rocket_vehicles rv SET first_flight = sub.first
        FROM (SELECT rocket_id, MIN(launch_time::date) AS first
              FROM launch_events
              WHERE rocket_id IS NOT NULL AND launch_time IS NOT NULL
              GROUP BY rocket_id) sub
        WHERE rv.id = sub.rocket_id AND rv.first_flight IS NULL"""),
    # last_flight: most recent past launch of this vehicle
    ("last_flight", """
        UPDATE rocket_vehicles rv SET last_flight = sub.last
        FROM (SELECT rocket_id, MAX(launch_time::date) AS last
              FROM launch_events
              WHERE rocket_id IS NOT NULL AND launch_time <= NOW()
              GROUP BY rocket_id) sub
        WHERE rv.id = sub.rocket_id AND rv.last_flight IS NULL"""),
    # propellant_1: the lowest core-stage engine's propellant
    ("propellant_1", """
        UPDATE rocket_vehicles rv SET propellant_1 = sub.propellant
        FROM (SELECT DISTINCT ON (re.rocket_id) re.rocket_id, e.propellant
              FROM rocket_engines re JOIN engines e ON e.id = re.engine_id
              WHERE re.stage >= 1 AND e.propellant IS NOT NULL
              ORDER BY re.rocket_id, re.stage ASC) sub
        WHERE rv.id = sub.rocket_id AND rv.propellant_1 IS NULL"""),
    # propellant_2: the highest (upper) stage engine's propellant
    ("propellant_2", """
        UPDATE rocket_vehicles rv SET propellant_2 = sub.propellant
        FROM (SELECT DISTINCT ON (re.rocket_id) re.rocket_id, e.propellant
              FROM rocket_engines re JOIN engines e ON e.id = re.engine_id
              WHERE re.stage >= 2 AND e.propellant IS NOT NULL
              ORDER BY re.rocket_id, re.stage DESC) sub
        WHERE rv.id = sub.rocket_id AND rv.propellant_2 IS NULL"""),
    # isp_vacuum: best vacuum specific impulse among the vehicle's engines
    ("isp_vacuum", """
        UPDATE rocket_vehicles rv SET isp_vacuum = sub.isp
        FROM (SELECT re.rocket_id, MAX(e.isp_vac_s) AS isp
              FROM rocket_engines re JOIN engines e ON e.id = re.engine_id
              WHERE e.isp_vac_s IS NOT NULL GROUP BY re.rocket_id) sub
        WHERE rv.id = sub.rocket_id AND rv.isp_vacuum IS NULL"""),
    # thrust_kn: total liftoff thrust = Σ (sea-level thrust × count) for stages 0–1
    ("thrust_kn", """
        UPDATE rocket_vehicles rv SET thrust_kn = sub.thrust
        FROM (SELECT re.rocket_id,
                     ROUND(SUM(COALESCE(e.thrust_sl_kn, e.thrust_vac_kn) * re.engine_count)) AS thrust
              FROM rocket_engines re JOIN engines e ON e.id = re.engine_id
              WHERE re.stage <= 1
                AND COALESCE(e.thrust_sl_kn, e.thrust_vac_kn) IS NOT NULL
              GROUP BY re.rocket_id) sub
        WHERE rv.id = sub.rocket_id AND rv.thrust_kn IS NULL"""),
    # reuse_type: a sensible label for vehicles flagged reusable
    ("reuse_type", """
        UPDATE rocket_vehicles SET reuse_type = 'Reusable first stage'
        WHERE reusable IS TRUE AND reuse_type IS NULL"""),
]


# Curated first/upper-stage propellants by family — textbook-documented, applied
# only where the engine-derived value is still NULL. (regex, propellant_1,
# propellant_2 or None when the upper stage varies/isn't confidently known.)
_FAMILY_PROPELLANTS: list[tuple[str, str, str | None]] = [
    # Long March splits by generation: 1–4 hypergolic, 5–10 kerolox/hydrolox.
    # (POSIX regex — no lookahead; [1-4]([^0-9]|$) prevents "10" matching "1".)
    (r"long\s*march\s*(5|6|7|8|9|10)", "RP-1 / LOX", None),
    (r"long\s*march\s*[1-4]([^0-9]|$)", "UDMH / N2O4", "UDMH / N2O4"),
    # Titan II/III/IV are hypergolic; Titan I is kerolox.
    # (Postgres POSIX word boundary is \y, NOT \b.)
    (r"titan\s*(2|3|4|ii|iii|iv)", "Aerozine-50 / N2O4", "Aerozine-50 / N2O4"),
    (r"titan\s*(1\y|i\y)", "RP-1 / LOX", None),
    (r"\yariane\y", "UDMH / N2O4", "UDMH / N2O4"),          # Ariane 1–4 (5/6 are engine-mapped)
    (r"tsiklon|tsyklon|dnepr|rokot|strela|kosmos|diamant", "UDMH / N2O4", "UDMH / N2O4"),
    (r"\yscout\y|minotaur|pegasus|\yvega\y|\ymu\y|m-v|kuaizhou|ceres|\ystart\y|shavit", "Solid", "Solid"),
    (r"\yatlas\y", "RP-1 / LOX", None),                     # Centaur/Agena uppers vary
    (r"\ythor\y|\ydelta\y", "RP-1 / LOX", None),
    (r"\yzenit\y|\yzenith\y", "RP-1 / LOX", None),
    (r"vostok|voskhod|sputnik|molniya|soyuz", "RP-1 / LOX", None),
    (r"zhuque", "CH4 / LOX", "CH4 / LOX"),
    (r"firefly", "RP-1 / LOX", "RP-1 / LOX"),
]


def enrich() -> dict:
    total = 0
    with cursor() as cur:
        for label, sql in _STEPS:
            cur.execute(sql)
            log.info("%-14s filled %d", label, cur.rowcount)
            total += cur.rowcount

        # Curated family propellants for vehicles not in the engine catalogue.
        fam_filled = 0
        for pattern, p1, p2 in _FAMILY_PROPELLANTS:
            cur.execute(
                "UPDATE rocket_vehicles SET propellant_1 = %s WHERE name ~* %s AND propellant_1 IS NULL",
                (p1, pattern),
            )
            fam_filled += cur.rowcount
            if p2:
                cur.execute(
                    "UPDATE rocket_vehicles SET propellant_2 = %s WHERE name ~* %s AND propellant_2 IS NULL",
                    (p2, pattern),
                )
                fam_filled += cur.rowcount
        log.info("%-14s filled %d", "family-prop", fam_filled)
        total += fam_filled
    return {"updated": total}


if __name__ == "__main__":
    print(enrich())
