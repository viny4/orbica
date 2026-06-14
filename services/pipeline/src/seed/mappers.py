"""Map Launch Library 2 JSON payloads onto Rocketpedia DB rows.

Defensive by design: LL2 nests data deeply and fields come and go between
records, so every accessor tolerates missing/None values.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any


def g(d: Any, *path: str, default: Any = None) -> Any:
    """Safely walk a nested dict by keys; return default if any hop is missing."""
    cur = d
    for key in path:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(key)
        if cur is None:
            return default
    return cur


def cdn(url: str | None) -> str | None:
    """Normalise Launch Library image URLs onto the reliable prod CDN.

    LL2's *dev* bucket (thespacedevs-dev) 404s on ~30% of files; the prod bucket
    hosts every one of them. Reference data is seeded from the dev API, so without
    this rewrite each sync re-introduces broken dev-CDN URLs. Idempotent.
    """
    if not url:
        return url
    return url.replace("thespacedevs-dev.nyc3", "thespacedevs-prod.nyc3")


def year_of(dt_str: str | None) -> int | None:
    if not dt_str:
        return None
    try:
        return datetime.fromisoformat(dt_str.replace("Z", "+00:00")).year
    except ValueError:
        return None


def date_of(dt_str: str | None) -> str | None:
    if not dt_str:
        return None
    try:
        return datetime.fromisoformat(dt_str.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return None


# LL2 launch status → our outcome vocabulary.
# Keyed on status.ABBREV (e.g. "Success"), NOT status.name ("Launch Successful").
_OUTCOME = {
    "Success": "success",
    "Failure": "failure",
    "Partial Failure": "partial_failure",
    "In Flight": "in_flight",
    "Go": "upcoming",
    "TBD": "upcoming",
    "TBC": "upcoming",
    "Hold": "upcoming",
    "Go for Launch": "upcoming",
    "To Be Confirmed": "upcoming",
    "To Be Determined": "upcoming",
}


def _country_alpha3(obj: Any) -> str | None:
    """LL2 2.3.0 exposes a `country` array of {alpha_2_code, alpha_3_code}."""
    c = obj.get("country")
    if isinstance(c, list) and c:
        return c[0].get("alpha_3_code") or c[0].get("alpha_2_code")
    if isinstance(c, dict):
        return c.get("alpha_3_code") or c.get("alpha_2_code")
    return (obj.get("country_code") or "")[:3] or None


def agency_row(a: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": a.get("name") or "Unknown",
        "abbrev": a.get("abbrev"),
        "country_code": _country_alpha3(a),
        "agency_type": g(a, "type", "name") or a.get("type"),
        "founding_year": a.get("founding_year"),
        "description": a.get("description"),
        "logo_url": cdn(g(a, "logo", "image_url")),
        "website": a.get("info_url") or a.get("wiki_url"),
        "total_launches": a.get("total_launch_count") or 0,
        "ll2_id": a.get("id"),
    }


def family_row(cfg: dict[str, Any], manufacturer_id: str | None) -> dict[str, Any] | None:
    families = cfg.get("families") or []
    fam = families[0] if families else None
    name = (fam or {}).get("name") if isinstance(fam, dict) else fam
    if not name:
        return None
    return {
        "name": name,
        "manufacturer_id": manufacturer_id,
        "country_code": _country_alpha3(cfg.get("manufacturer") or {}),
        "first_flight": date_of(cfg.get("maiden_flight")),
        "description": (fam or {}).get("description") if isinstance(fam, dict) else None,
        "ll2_id": (fam or {}).get("id") if isinstance(fam, dict) else None,
    }


def vehicle_row(cfg: dict[str, Any], family_id: str | None) -> dict[str, Any]:
    return {
        "family_id": family_id,
        "name": cfg.get("full_name") or cfg.get("name") or "Unknown",
        "variant": cfg.get("variant"),
        "status": "active" if cfg.get("active") else "retired",
        "height_m": cfg.get("length"),
        "diameter_m": cfg.get("diameter"),
        "mass_kg": _tons_to_kg(cfg.get("launch_mass")),
        "stages": cfg.get("max_stage") or cfg.get("min_stage"),
        "payload_leo_kg": cfg.get("leo_capacity"),
        "payload_gto_kg": cfg.get("gto_capacity"),
        "payload_sso_kg": cfg.get("sso_capacity"),
        "thrust_kn": cfg.get("to_thrust"),
        "reusable": bool(cfg.get("reusable")),
        "first_flight": date_of(cfg.get("maiden_flight")),
        "total_launches": cfg.get("total_launch_count") or 0,
        "successful_launches": cfg.get("successful_launches") or 0,
        "failed_launches": cfg.get("failed_launches") or 0,
        "image_url": cdn(g(cfg, "image", "image_url") or cfg.get("image_url")),
        "description": cfg.get("description"),
        "ll2_id": cfg.get("id"),
    }


def pad_row(pad: dict[str, Any], operator_id: str | None) -> dict[str, Any]:
    lat = pad.get("latitude")
    lon = pad.get("longitude")
    location = None
    if lat is not None and lon is not None:
        # PostGIS EWKT point (lon lat) in WGS84.
        location = f"SRID=4326;POINT({lon} {lat})"
    return {
        "name": pad.get("name") or g(pad, "location", "name") or "Unknown",
        "code": str(pad.get("id")) if pad.get("id") else None,
        "operator_id": operator_id,
        # LL2 2.3.0 exposes the pad's country as location.country {alpha_3_code...},
        # not the old location.country_code string (which is now always null).
        "country_code": _country_alpha3(pad.get("location") or {}),
        "location": location,
        "active": bool(pad.get("active", True)),
        "ll2_id": pad.get("id"),
    }


def launch_row(
    launch: dict[str, Any],
    rocket_id: str | None,
    agency_id: str | None,
    site_id: str | None,
) -> dict[str, Any]:
    net = launch.get("net")
    # status.abbrev ("Success"/"Failure") is the stable machine key;
    # status.name is the verbose label ("Launch Successful").
    status_abbrev = g(launch, "status", "abbrev") or g(launch, "status", "name")
    return {
        "name": launch.get("name") or "Unknown",
        "rocket_id": rocket_id,
        "agency_id": agency_id,
        "launch_site_id": site_id,
        "launch_time": net,
        "launch_year": year_of(net),
        "window_start": launch.get("window_start"),
        "window_end": launch.get("window_end"),
        "outcome": _OUTCOME.get(status_abbrev, "unknown"),
        "failure_reason": launch.get("failreason") or None,
        "mission_name": g(launch, "mission", "name"),
        "mission_description": g(launch, "mission", "description"),
        "mission_type": g(launch, "mission", "type"),
        "orbit_achieved": g(launch, "mission", "orbit", "name"),
        # Launch ids are UUID strings in LL2 → stored in ll2_uuid (see 03_adjustments.sql).
        "ll2_uuid": launch.get("id"),
    }


def _tons_to_kg(tons: Any) -> float | None:
    try:
        return float(tons) * 1000.0 if tons is not None else None
    except (TypeError, ValueError):
        return None
