"""Seed the curated rocket-engine catalogue and map engines to vehicles.

Launch Library 2 has no clean per-engine data, so this is hand-curated from
public manufacturer/agency specs. ENGINES is the catalogue; MAPPINGS attaches
engines to vehicles by name pattern (most-specific first — only the first match
applies per vehicle, like the 3D config rules).

Run:  python -m src.seed.engines_seed
"""
from __future__ import annotations

import logging
import re

from src.db.pool import cursor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("engines")

# name, manufacturer, cycle, propellant, thrust_sl_kn, thrust_vac_kn, isp_sl, isp_vac, first_flight, description
ENGINES: list[tuple] = [
    ("Merlin 1D", "SpaceX", "gas-generator", "RP-1 / LOX", 845, 914, 282, 311, 2013,
     "Sea-level kerolox engine; nine in a cluster power the Falcon 9 and Falcon Heavy first stages."),
    ("Merlin 1D Vacuum", "SpaceX", "gas-generator", "RP-1 / LOX", None, 981, None, 348, 2013,
     "Vacuum-optimised Merlin with a large expansion nozzle; a single unit powers the Falcon upper stage."),
    ("Merlin 1C", "SpaceX", "gas-generator", "RP-1 / LOX", 350, 420, 267, 304, 2008,
     "Regeneratively-cooled early Merlin used on the Falcon 1 and Falcon 9 v1.0."),
    ("Kestrel", "SpaceX", "pressure-fed", "RP-1 / LOX", None, 31, None, 317, 2006,
     "Ablatively-cooled upper-stage engine of the retired Falcon 1."),
    ("Raptor 2", "SpaceX", "full-flow staged combustion", "CH4 / LOX", 2256, 2454, 327, 363, 2021,
     "Methalox full-flow staged-combustion engine; 33 power the Super Heavy booster."),
    ("Raptor Vacuum", "SpaceX", "full-flow staged combustion", "CH4 / LOX", None, 2400, None, 380, 2021,
     "Vacuum Raptor with an expanded nozzle for the Starship upper stage."),
    ("RS-25 (SSME)", "Aerojet Rocketdyne", "staged-combustion", "LH2 / LOX", 1860, 2279, 366, 452, 1981,
     "The reusable Space Shuttle Main Engine, now expended on the SLS core stage."),
    ("RS-68A", "Aerojet Rocketdyne", "gas-generator", "LH2 / LOX", 3137, 3560, 360, 412, 2002,
     "The most powerful hydrogen engine ever flown; powers the Delta IV core."),
    ("RD-180", "NPO Energomash", "staged-combustion", "RP-1 / LOX", 3830, 4150, 311, 338, 2000,
     "Russian dual-chamber engine powering the Atlas V first stage."),
    ("RD-181", "NPO Energomash", "staged-combustion", "RP-1 / LOX", 1860, 2070, 297, 333, 2015,
     "Single-chamber RD-191 derivative; two power the Antares first stage."),
    ("RD-191", "NPO Energomash", "staged-combustion", "RP-1 / LOX", 1920, 2090, 310, 337, 2014,
     "Single-chamber engine for the Angara universal rocket module."),
    ("RD-275M", "NPO Energomash", "staged-combustion", "UDMH / N2O4", 1746, 1830, 287, 316, 2007,
     "Storable-propellant engine; six chambers power the Proton-M first stage."),
    ("RD-107A", "NPO Energomash / Kuznetsov", "gas-generator", "RP-1 / LOX", 838, 1020, 263, 320, 2004,
     "Powers the four strap-on boosters of the Soyuz rocket."),
    ("RD-108A", "NPO Energomash / Kuznetsov", "gas-generator", "RP-1 / LOX", 792, 921, 258, 315, 2001,
     "Central core-stage engine of the Soyuz."),
    ("RD-0110", "KBKhA", "gas-generator", "RP-1 / LOX", None, 298, None, 326, 1967,
     "Third-stage (Blok I) engine of the Soyuz."),
    ("RL10", "Aerojet Rocketdyne", "expander", "LH2 / LOX", None, 110, None, 451, 1963,
     "Long-serving cryogenic upper-stage engine (Centaur, DCSS)."),
    ("BE-4", "Blue Origin", "staged-combustion", "CH4 / LOX", 2400, 2450, None, 340, 2024,
     "Oxygen-rich staged-combustion methalox engine powering ULA Vulcan and New Glenn."),
    ("BE-3", "Blue Origin", "combustion tap-off", "LH2 / LOX", 490, 710, None, None, 2015,
     "Deeply-throttleable hydrogen engine powering the New Shepard."),
    ("Vulcain 2", "ArianeGroup", "gas-generator", "LH2 / LOX", 936, 1359, 318, 433, 2002,
     "Core-stage cryogenic engine of the Ariane 5 ECA."),
    ("Vulcain 2.1", "ArianeGroup", "gas-generator", "LH2 / LOX", 950, 1370, None, 432, 2024,
     "Evolved Vulcain powering the Ariane 6 core stage."),
    ("HM7B", "ArianeGroup", "gas-generator", "LH2 / LOX", None, 67, None, 446, 1979,
     "Cryogenic upper-stage engine of the Ariane 5 ECA."),
    ("Vinci", "ArianeGroup", "expander", "LH2 / LOX", None, 180, None, 457, 2024,
     "Re-ignitable cryogenic upper-stage engine for the Ariane 6."),
    ("F-1", "Rocketdyne", "gas-generator", "RP-1 / LOX", 6770, 7770, 263, 304, 1967,
     "The most powerful single-chamber liquid engine ever flown; five powered the Saturn V S-IC."),
    ("J-2", "Rocketdyne", "gas-generator", "LH2 / LOX", None, 1033, None, 421, 1966,
     "Hydrogen engine of the Saturn V second and third stages."),
    ("Rutherford", "Rocket Lab", "electric-pump", "RP-1 / LOX", 25, 26, 215, 311, 2017,
     "The first electric-pump-fed engine to fly; nine power the Electron first stage."),
    ("Rutherford Vacuum", "Rocket Lab", "electric-pump", "RP-1 / LOX", None, 26, None, 343, 2017,
     "Vacuum Rutherford for the Electron second stage."),
    ("YF-100", "CASC", "staged-combustion", "RP-1 / LOX", 1200, 1340, 300, 335, 2015,
     "China's first staged-combustion kerolox engine; used across Long March 5/6/7."),
    ("YF-77", "CASC", "gas-generator", "LH2 / LOX", 510, 700, None, 430, 2016,
     "Hydrogen core engine of the Long March 5."),
    ("LE-7A", "Mitsubishi / IHI", "staged-combustion", "LH2 / LOX", 870, 1098, 349, 440, 2001,
     "Core-stage engine of the H-IIA and H-IIB."),
    ("LE-5B", "Mitsubishi", "expander-bleed", "LH2 / LOX", None, 137, None, 447, 2001,
     "Upper-stage cryogenic engine of the H-IIA/B and H3."),
    ("LE-9", "Mitsubishi / IHI", "expander-bleed", "LH2 / LOX", 1471, 1471, None, 425, 2024,
     "New expander-bleed core engine of the H3."),
    ("Vikas", "ISRO", "gas-generator", "UDMH / N2O4", 725, 800, None, 293, 1992,
     "Storable-propellant engine used across PSLV and GSLV stages."),
    ("CE-20", "ISRO", "gas-generator", "LH2 / LOX", None, 200, None, 443, 2017,
     "Cryogenic upper-stage engine of the LVM3 (GSLV Mk III)."),
    ("CE-7.5", "ISRO", "staged-combustion", "LH2 / LOX", None, 73, None, 454, 2010,
     "Cryogenic upper-stage engine of the GSLV Mk II."),
    ("RS-27A", "Rocketdyne", "gas-generator", "RP-1 / LOX", 1054, 1085, 255, 302, 1990,
     "First-stage engine of the Delta II."),
    ("AJ-10", "Aerojet Rocketdyne", "pressure-fed", "NTO / Aerozine-50", None, 43, None, 319, 1962,
     "Long-serving restartable upper-stage and maneuvering engine (Delta II, Orion)."),
    ("NK-33 / AJ-26", "Kuznetsov / Aerojet", "staged-combustion", "RP-1 / LOX", 1638, 1755, 297, 331, 2013,
     "A 1960s Soviet engine refurbished as the AJ-26 for the early Antares."),
    ("GEM 63", "Northrop Grumman", "solid", "solid (HTPB)", 1663, None, None, 279, 2020,
     "Graphite-epoxy strap-on solid motor for Atlas V and Vulcan."),
    ("P120C", "Avio / ArianeGroup", "solid", "solid (HTPB)", 4500, None, None, 278, 2020,
     "Common solid motor: Ariane 6 boosters and Vega-C first stage."),
]

# (pattern, [(engine_name, stage, count, note)]) — most-specific first; first match wins.
# stage: 0 = booster/strap-on, 1 = first/core, 2 = second, 3 = third.
MAPPINGS: list[tuple[str, list[tuple]]] = [
    (r"falcon\s*heavy", [("Merlin 1D", 1, 27, "9 per core × 3 cores"), ("Merlin 1D Vacuum", 2, 1, None)]),
    (r"falcon\s*9", [("Merlin 1D", 1, 9, None), ("Merlin 1D Vacuum", 2, 1, None)]),
    (r"falcon\s*1", [("Merlin 1C", 1, 1, None), ("Kestrel", 2, 1, None)]),
    (r"starship|super\s*heavy", [("Raptor 2", 1, 33, "Super Heavy booster"),
                                 ("Raptor 2", 2, 3, "sea-level, ship"), ("Raptor Vacuum", 2, 3, "ship")]),
    (r"space\s*shuttle|sts", [("RS-25 (SSME)", 1, 3, "orbiter main engines")]),
    (r"sls|space\s*launch\s*system", [("RS-25 (SSME)", 1, 4, "core stage")]),
    (r"delta\s*iv\s*heavy", [("RS-68A", 1, 3, "three CBC cores"), ("RL10", 2, 1, None)]),
    (r"delta\s*iv", [("RS-68A", 1, 1, None), ("RL10", 2, 1, None)]),
    (r"delta\s*ii", [("RS-27A", 1, 1, None), ("AJ-10", 2, 1, None)]),
    (r"atlas\s*v", [("RD-180", 1, 1, None), ("RL10", 2, 1, "Centaur"), ("GEM 63", 0, 1, "0–5 strap-ons")]),
    (r"vulcan", [("BE-4", 1, 2, None), ("RL10", 2, 2, "Centaur V"), ("GEM 63", 0, 2, "0–6 strap-ons")]),
    (r"new\s*glenn", [("BE-4", 1, 7, None)]),
    (r"new\s*shepard", [("BE-3", 1, 1, None)]),
    (r"antares", [("RD-181", 1, 2, None)]),
    (r"ariane\s*6", [("Vulcain 2.1", 1, 1, None), ("Vinci", 2, 1, None), ("P120C", 0, 2, "2 or 4 boosters")]),
    (r"ariane\s*5", [("Vulcain 2", 1, 1, None), ("HM7B", 2, 1, None)]),
    (r"soyuz|molniya|voskhod", [("RD-107A", 0, 4, "four boosters"), ("RD-108A", 1, 1, "core"),
                                ("RD-0110", 3, 1, "Blok I")]),
    (r"saturn\s*v", [("F-1", 1, 5, "S-IC"), ("J-2", 2, 5, "S-II"), ("J-2", 3, 1, "S-IVB")]),
    (r"electron", [("Rutherford", 1, 9, None), ("Rutherford Vacuum", 2, 1, None)]),
    (r"angara", [("RD-191", 1, 1, "per URM-1 module")]),
    (r"proton", [("RD-275M", 1, 6, None)]),
    (r"long\s*march\s*5", [("YF-77", 1, 2, "core"), ("YF-100", 0, 8, "4 boosters × 2")]),
    (r"long\s*march\s*7", [("YF-100", 1, 2, "core"), ("YF-100", 0, 4, "4 boosters")]),
    (r"long\s*march\s*6", [("YF-100", 1, 1, None)]),
    (r"h-?iib|h2b", [("LE-7A", 1, 2, None), ("LE-5B", 2, 1, None)]),
    (r"h-?iia|h2a", [("LE-7A", 1, 1, None), ("LE-5B", 2, 1, None)]),
    (r"h3|h-?3", [("LE-9", 1, 2, "2 or 3"), ("LE-5B", 2, 1, None)]),
    (r"lvm3|gslv\s*mk\s*iii|gslv\s*mk\s*3", [("Vikas", 1, 2, "L110 core"), ("CE-20", 2, 1, None)]),
    (r"gslv\s*mk\s*ii|gslv\s*mk\s*2|gslv", [("Vikas", 1, 1, None), ("CE-7.5", 3, 1, None)]),
    (r"pslv", [("Vikas", 2, 1, "PS2")]),
]


def seed() -> None:
    with cursor() as cur:
        # 1) upsert the engine catalogue
        for e in ENGINES:
            cur.execute(
                """
                INSERT INTO engines
                  (name, manufacturer, cycle, propellant, thrust_sl_kn, thrust_vac_kn,
                   isp_sl_s, isp_vac_s, first_flight, description)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (name) DO UPDATE SET
                  manufacturer=EXCLUDED.manufacturer, cycle=EXCLUDED.cycle,
                  propellant=EXCLUDED.propellant, thrust_sl_kn=EXCLUDED.thrust_sl_kn,
                  thrust_vac_kn=EXCLUDED.thrust_vac_kn, isp_sl_s=EXCLUDED.isp_sl_s,
                  isp_vac_s=EXCLUDED.isp_vac_s, first_flight=EXCLUDED.first_flight,
                  description=EXCLUDED.description
                """,
                e,
            )
        cur.execute("SELECT id, name FROM engines")
        eng_id = {r["name"]: r["id"] for r in cur.fetchall()}

        # 2) map engines onto vehicles (first matching pattern wins per vehicle)
        cur.execute("SELECT id, name, COALESCE(variant,'') AS variant FROM rocket_vehicles")
        vehicles = cur.fetchall()
        compiled = [(re.compile(p, re.I), engs) for p, engs in MAPPINGS]

        mapped = 0
        for v in vehicles:
            vid, name, variant = v["id"], v["name"], v["variant"]
            hay = f"{name} {variant}"
            match = next((engs for rx, engs in compiled if rx.search(hay)), None)
            if not match:
                continue
            for ename, stage, count, note in match:
                if ename not in eng_id:
                    log.warning("unknown engine in mapping: %s", ename)
                    continue
                cur.execute(
                    """
                    INSERT INTO rocket_engines (rocket_id, engine_id, stage, engine_count, note)
                    VALUES (%s,%s,%s,%s,%s)
                    ON CONFLICT (rocket_id, engine_id, stage)
                    DO UPDATE SET engine_count=EXCLUDED.engine_count, note=EXCLUDED.note
                    """,
                    (vid, eng_id[ename], stage, count, note),
                )
            mapped += 1
        log.info("engines: %d catalogued, %d vehicles mapped", len(ENGINES), mapped)


if __name__ == "__main__":
    seed()
