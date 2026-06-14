"""Space weather — pulls live geomagnetic + solar-wind conditions from NOAA SWPC
(free, no key) and records the LEO-drag implication. Geomagnetic storms heat and
expand the upper atmosphere, increasing drag on low satellites.

Run:  python -m src.spaceweather
"""
from __future__ import annotations

import logging

import httpx

from src.db import cursor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("spaceweather")

KP_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
WIND_URL = "https://services.swpc.noaa.gov/products/solar-wind/plasma-2-hour.json"


def _kp_state(kp: float) -> tuple[str, str]:
    if kp >= 9:
        return "Storm G5 (extreme)", "Severe LEO drag; satellite tracking degraded."
    if kp >= 8:
        return "Storm G4 (severe)", "Strong upper-atmosphere heating; elevated LEO decay."
    if kp >= 7:
        return "Storm G3 (strong)", "Increased atmospheric drag on low satellites."
    if kp >= 6:
        return "Storm G2 (moderate)", "Noticeable extra drag in low Earth orbit."
    if kp >= 5:
        return "Storm G1 (minor)", "Minor increase in LEO atmospheric drag."
    if kp >= 4:
        return "Active", "Slightly unsettled; nominal drag."
    if kp >= 3:
        return "Unsettled", "Quiet to unsettled; nominal conditions."
    return "Quiet", "Calm geomagnetic field; nominal satellite drag."


def _last(data, dict_key: str, list_idx: int):
    """SWPC returns either a list of dicts or a list of rows — handle both."""
    row = data[-1]
    val = row.get(dict_key) if isinstance(row, dict) else row[list_idx]
    return float(val)


def fetch() -> dict:
    out = {"kp": None, "wind": None}
    with httpx.Client(timeout=20.0, follow_redirects=True, headers={"User-Agent": "orbica/0.1"}) as c:
        try:
            out["kp"] = _last(c.get(KP_URL).json(), "Kp", 1)
        except Exception as exc:
            log.warning("Kp fetch failed: %s", exc)
        try:
            out["wind"] = _last(c.get(WIND_URL).json(), "speed", 2)
        except Exception as exc:
            log.warning("wind fetch failed: %s", exc)
    return out


def compute() -> dict:
    sw = fetch()
    kp = sw["kp"]
    if kp is None:
        log.warning("no Kp available; skipping")
        return sw
    state, note = _kp_state(kp)
    with cursor() as cur:
        cur.execute(
            "INSERT INTO space_weather (kp, kp_state, solar_wind_kms, note) VALUES (%s,%s,%s,%s)",
            (kp, state, sw["wind"], note),
        )
        # keep only the most recent 50 readings
        cur.execute("DELETE FROM space_weather WHERE id NOT IN (SELECT id FROM space_weather ORDER BY captured_at DESC LIMIT 50)")
        if kp >= 5:
            cur.execute(
                "INSERT INTO space_events (kind, title, detail, occurred_at, href) "
                "VALUES ('storm', %s, %s, NOW(), '/intel') ON CONFLICT DO NOTHING",
                (f"Geomagnetic storm — Kp {kp:.0f} ({state})", note),
            )
    log.info("space weather: Kp=%.1f (%s), wind=%s km/s", kp, state, sw["wind"])
    return {**sw, "state": state}


if __name__ == "__main__":
    compute()
