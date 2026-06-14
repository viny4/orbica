"""Unit tests for the LL2 → DB mappers (no network, no DB)."""
from src.seed import mappers as m


def test_g_walks_nested_dicts():
    d = {"a": {"b": {"c": 42}}}
    assert m.g(d, "a", "b", "c") == 42
    assert m.g(d, "a", "x", default="fallback") == "fallback"
    assert m.g(None, "a") is None


def test_year_and_date_parsing():
    assert m.year_of("2026-06-13T10:30:00Z") == 2026
    assert m.date_of("2026-06-13T10:30:00Z") == "2026-06-13"
    assert m.year_of(None) is None
    assert m.date_of("garbage") is None


def test_agency_row_maps_core_fields():
    payload = {
        "id": 121,
        "name": "SpaceX",
        "abbrev": "SpX",
        "country_code": "USA",
        "type": {"name": "Commercial"},
        "founding_year": 2002,
        "logo": {"image_url": "http://x/logo.png"},
        "total_launch_count": 300,
    }
    row = m.agency_row(payload)
    assert row["name"] == "SpaceX"
    assert row["country_code"] == "USA"
    assert row["agency_type"] == "Commercial"
    assert row["logo_url"] == "http://x/logo.png"
    assert row["total_launches"] == 300
    assert row["ll2_id"] == 121


def test_vehicle_row_converts_mass_tons_to_kg():
    cfg = {"id": 7, "name": "Falcon 9", "launch_mass": 549, "reusable": True, "active": True}
    row = m.vehicle_row(cfg, family_id=None)
    assert row["mass_kg"] == 549000.0
    assert row["reusable"] is True
    assert row["status"] == "active"


def test_outcome_mapping():
    # Real LL2 shape: status.abbrev is the machine key, status.name is verbose.
    launch = {
        "id": "uuid-1",
        "name": "Test",
        "status": {"name": "Launch Successful", "abbrev": "Success"},
        "net": "1969-07-16T13:32:00Z",
    }
    row = m.launch_row(launch, None, None, None)
    assert row["outcome"] == "success"
    assert row["launch_year"] == 1969
    assert row["ll2_uuid"] == "uuid-1"


def test_outcome_failure_and_unknown():
    fail = {"id": "u2", "name": "x", "status": {"name": "Launch Failure", "abbrev": "Failure"}}
    assert m.launch_row(fail, None, None, None)["outcome"] == "failure"
    # Missing status → unknown, never crashes.
    assert m.launch_row({"id": "u3", "name": "x"}, None, None, None)["outcome"] == "unknown"


def test_pad_row_builds_postgis_point():
    pad = {"id": 9, "name": "LC-39A", "latitude": 28.6, "longitude": -80.6, "active": True}
    row = m.pad_row(pad, None)
    assert row["location"] == "SRID=4326;POINT(-80.6 28.6)"
