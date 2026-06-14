"""Enrich + expand satellites from SATCAT, then link them to launches.

Sources merged (deduped by NORAD id):
  • SATCAT "active" group  — current on-orbit objects
  • SATCAT full CSV        — adds deep-space probes + extra payloads
  • curated deep-space names — Cassini, Voyager, New Horizons, … (decayed/escaped,
                               absent from on-orbit feeds), classified by destination

Each object gets launch date/site, COSPAR, orbit regime + parameters, object type,
owner, ops status, derived purpose, and (for interplanetary craft) its destination
body from SATCAT's ORBIT_CENTER.

Bulk load via COPY into a TEMP table + one set-based UPDATE/INSERT.

Run:  python -m src.seed.enrich_satellites
"""
from __future__ import annotations

import logging

from src.clients.satcat import SatcatClient
from src.db.pool import cursor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("enrich")

# SATCAT ORBIT_CENTER → human destination. Anything not Earth is interplanetary.
ORBIT_CENTER = {
    "EM": "Earth-Moon L-point", "MO": "Lunar", "LU": "Lunar", "EL": "Earth-Moon L-point",
    "SU": "Heliocentric", "SS": "Interstellar", "ME": "Mercury", "VE": "Venus", "MA": "Mars",
    "JU": "Jupiter", "SA": "Saturn", "UR": "Uranus", "NE": "Neptune", "PL": "Pluto",
    "AS": "Asteroid", "CO": "Comet",
}

# Famous deep-space / planetary missions fetched explicitly by name.
DEEP_SPACE_NAMES = [
    "VOYAGER", "PIONEER", "CASSINI", "NEW HORIZONS", "JUNO", "GALILEO PROBE", "ULYSSES",
    "MAGELLAN", "MESSENGER", "ROSETTA", "DAWN", "JWST", "JAMES WEBB", "SPITZER", "KEPLER",
    "PARKER", "LUCY", "JUICE", "OSIRIS", "HAYABUSA", "BEPICOLOMBO", "AKATSUKI", "VIKING",
    "MAVEN", "INSIGHT", "CURIOSITY", "PERSEVERANCE", "PHOENIX", "CHANDRAYAAN", "TIANWEN",
    "LUNA ", "SURVEYOR", "RANGER", "GENESIS", "STARDUST", "DEEP IMPACT", "NEAR",
    "MARS EXPRESS", "MARS ODYSSEY", "MARS RECONNAISSANCE", "GAIA", "SOHO",
]


DEEP_SET = set(ORBIT_CENTER.values()) | {"Deep Space"}


def derive_orbit(apogee, perigee, period, center) -> str | None:
    a = float(apogee) if apogee not in (None, "") else None
    # A sensible Earth apogee wins, even if the SATCAT centre code is odd — so
    # ISS-region craft (Progress, Soyuz…) stay LEO, not "deep space".
    if a is not None and a < 50000:
        p = float(perigee) if perigee not in (None, "") else a
        if a < 2000:
            return "LEO"
        if p < 2000 and a > 25000:
            return "HEO"
        if a < 35000:
            return "MEO"
        return "GEO"
    if center and center not in ("EA", ""):
        return ORBIT_CENTER.get(center, "Deep Space")
    if a is not None:
        return "HEO"
    return None


_PURPOSE = [
    ("Communications", ["STARLINK", "ONEWEB", "IRIDIUM", "GLOBALSTAR", "INTELSAT", "SES-", "EUTELSAT", "TELSTAR", "INMARSAT", "VIASAT", "O3B", "KUIPER", "ECHOSTAR", "THURAYA", "YAHSAT"]),
    ("Navigation", ["GPS", "NAVSTAR", "GLONASS", "GALILEO", "BEIDOU", "COMPASS", "QZS", "IRNSS", "NAVIC"]),
    ("Weather", ["NOAA", "GOES", "METEOR", "METEOSAT", "HIMAWARI", "FENGYUN", "FY-", "DMSP", "ELEKTRO", "INSAT"]),
    ("Earth Observation", ["LANDSAT", "SENTINEL", "WORLDVIEW", "TERRA", "AQUA", "SPOT", "PLANET", "DOVE", "FLOCK", "CARTOSAT", "RESOURCESAT", "ICEYE", "CAPELLA", "SKYSAT", "GAOFEN", "PLEIADES"]),
    ("Space Telescope", ["HUBBLE", "HST", "JWST", "WEBB", "SPITZER", "KEPLER", "TESS", "CHANDRA", "GAIA", "XMM", "EUCLID", "IXPE"]),
    ("Human Spaceflight", ["ISS", "ZARYA", "TIANGONG", "TIANHE", "PROGRESS", "CYGNUS", "DRAGON", "SOYUZ-MS", "SOYUZ MS", "SHENZHOU", "TIANZHOU", "CREW", "APOLLO", "GEMINI"]),
]


def derive_purpose(name: str, object_type: str | None, is_deep: bool) -> str:
    if object_type == "R/B":
        return "Rocket Body"
    if object_type == "DEB":
        return "Debris"
    up = (name or "").upper()
    for label, keys in _PURPOSE:
        if any(k in up for k in keys):
            return label
    # Only call it planetary science if it's genuinely beyond Earth orbit.
    if is_deep:
        return "Planetary Science"
    return "Payload"


_CONSTELLATIONS = [
    ("Starlink", "starlink%"), ("OneWeb", "oneweb%"), ("Iridium", "iridium%"),
    ("Globalstar", "globalstar%"), ("GPS", "navstar%"), ("Galileo", "galileo%"),
    ("Beidou", "beidou%"), ("Kuiper", "kuiper%"), ("OrbComm", "orbcomm%"),
]


def _f(v):
    try:
        return float(v) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _to_row(r: dict) -> tuple | None:
    norad = r.get("NORAD_CAT_ID")
    if not norad:
        return None
    ld = (r.get("LAUNCH_DATE") or "") or None
    dd = (r.get("DECAY_DATE") or "") or None
    ap, pe, per = _f(r.get("APOGEE")), _f(r.get("PERIGEE")), _f(r.get("PERIOD"))
    center = r.get("ORBIT_CENTER")
    name = r.get("OBJECT_NAME") or "Unknown"
    otype = r.get("OBJECT_TYPE")
    orbit = derive_orbit(ap, pe, per, center)
    return (
        int(norad), r.get("OBJECT_ID") or None, otype, r.get("OWNER"),
        ld, (int(ld[:4]) if ld else None), r.get("LAUNCH_SITE") or None,
        pe, ap, _f(r.get("INCLINATION")), per, r.get("OPS_STATUS_CODE") or None,
        dd, _f(r.get("RCS")), orbit,
        derive_purpose(name, otype, orbit in DEEP_SET), name,
    )


def gather() -> list[tuple]:
    seen: set[int] = set()
    rows: list[tuple] = []

    def add(records):
        for r in records:
            row = _to_row(r)
            if row and row[0] not in seen:
                seen.add(row[0])
                rows.append(row)

    with SatcatClient() as c:
        add(c.records("active"))
        add(c.full_csv())
        log.info("after active + full CSV: %d unique", len(rows))
        for nm in DEEP_SPACE_NAMES:
            add(c.by_name(nm))
        log.info("after deep-space names: %d unique", len(rows))
    return rows


def load(rows: list[tuple]) -> tuple[int, int]:
    with cursor() as cur:
        cur.execute("""
            CREATE TEMP TABLE stage(
                norad int, cospar text, otype text, owner text, ld date, ly int, site text,
                peri numeric, apo numeric, incl numeric, period numeric, ops text,
                decay date, rcs numeric, orbit text, purpose text, name text
            ) ON COMMIT DROP
        """)
        with cur.copy(
            "COPY stage (norad,cospar,otype,owner,ld,ly,site,peri,apo,incl,period,ops,decay,rcs,orbit,purpose,name) FROM STDIN"
        ) as cp:
            for row in rows:
                cp.write_row(row)

        cur.execute("""
            UPDATE satellites s SET
                cospar_id = COALESCE(s.cospar_id, st.cospar),
                object_type = st.otype, owner_code = st.owner,
                launch_date = st.ld, launch_year = st.ly, launch_site_code = st.site,
                altitude_periapsis_km = st.peri, altitude_apoapsis_km = st.apo,
                inclination_deg = st.incl, period_minutes = st.period,
                ops_status = st.ops, reentry_date = st.decay, rcs_m2 = st.rcs,
                orbit_type = st.orbit, purpose = st.purpose, updated_at = NOW()
            FROM stage st WHERE s.norad_id = st.norad
        """)
        updated = cur.rowcount

        # Insert payloads (incl. deep-space craft) we don't yet track.
        cur.execute("""
            INSERT INTO satellites
                (name, norad_id, cospar_id, object_type, owner_code, launch_date, launch_year,
                 launch_site_code, altitude_periapsis_km, altitude_apoapsis_km, inclination_deg,
                 period_minutes, ops_status, reentry_date, rcs_m2, orbit_type, purpose, status)
            SELECT st.name, st.norad, st.cospar, st.otype, st.owner, st.ld, st.ly, st.site,
                   st.peri, st.apo, st.incl, st.period, st.ops, st.decay, st.rcs, st.orbit, st.purpose,
                   CASE WHEN st.decay IS NOT NULL THEN 'decayed' ELSE 'active' END
            FROM stage st
            WHERE st.otype = 'PAY'
              AND NOT EXISTS (SELECT 1 FROM satellites s WHERE s.norad_id = st.norad)
            ON CONFLICT (norad_id) DO NOTHING
        """)
        inserted = cur.rowcount

        for label, pat in _CONSTELLATIONS:
            cur.execute(
                "UPDATE satellites SET constellation = %s WHERE constellation IS NULL AND name ILIKE %s",
                (label, pat),
            )

    log.info("enriched %d, inserted %d payloads", updated, inserted)
    return updated, inserted


def link_to_launches() -> int:
    with cursor() as cur:
        cur.execute("""
            UPDATE satellites s SET launch_event_id = le.id
            FROM launch_events le
            WHERE s.launch_event_id IS NULL
              AND s.launch_date IS NOT NULL
              AND le.launch_time::date = s.launch_date
              AND le.agency_id IS NOT NULL
        """)
        return cur.rowcount


def main() -> None:
    rows = gather()
    load(rows)
    linked = link_to_launches()
    log.info("linked %d satellites to launch events", linked)


if __name__ == "__main__":
    main()
