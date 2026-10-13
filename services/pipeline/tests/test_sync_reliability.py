"""Reliability behaviour of the sync: what gets retried, and what gets counted."""
from __future__ import annotations

import httpx
import pytest

from src.clients import http_retry as hr
from src.seed import mappers as m
from src.seed.historical_seed import _tally


def _status_error(code: int, headers: dict | None = None) -> httpx.HTTPStatusError:
    req = httpx.Request("GET", "https://example.test/x")
    return httpx.HTTPStatusError("boom", request=req, response=httpx.Response(code, headers=headers or {}, request=req))


@pytest.mark.parametrize("code,expected", [(429, True), (500, True), (503, True), (408, True), (400, False), (401, False), (403, False), (404, False)])
def test_only_transient_statuses_are_retried(code, expected):
    assert hr.is_transient(_status_error(code)) is expected


def test_network_errors_are_transient():
    assert hr.is_transient(httpx.ConnectTimeout("t"))
    assert not hr.is_transient(ValueError("bug"))


def test_retry_after_parsing():
    assert hr.retry_after_seconds(httpx.Response(429, headers={"Retry-After": "7"})) == 7
    assert hr.retry_after_seconds(httpx.Response(429)) is None
    assert hr.retry_after_seconds(httpx.Response(429, headers={"Retry-After": "soon"})) is None
    # HTTP-date in the past clamps to zero rather than going negative.
    assert hr.retry_after_seconds(httpx.Response(503, headers={"Retry-After": "Wed, 21 Oct 2015 07:28:00 GMT"})) == 0


@pytest.fixture
def no_sleep(monkeypatch):
    # tenacity sleeps via time.sleep; make retries instant.
    monkeypatch.setattr("tenacity.nap.time.sleep", lambda _s: None)


def _flaky(codes: list[int]):
    calls = {"n": 0}

    @hr.http_retry(attempts=5)
    def fetch():
        code = codes[min(calls["n"], len(codes) - 1)]
        calls["n"] += 1
        if code >= 400:
            raise _status_error(code)
        return "ok"

    return fetch, calls


def test_permanent_error_fails_fast(no_sleep):
    fetch, calls = _flaky([403])
    with pytest.raises(httpx.HTTPStatusError):
        fetch()
    assert calls["n"] == 1  # used to be 5 attempts (~3 min of backoff)


def test_transient_error_recovers(no_sleep):
    fetch, calls = _flaky([503, 429, 200])
    assert fetch() == "ok"
    assert calls["n"] == 3


def test_retries_are_bounded(no_sleep):
    fetch, calls = _flaky([500])
    with pytest.raises(httpx.HTTPStatusError):
        fetch()
    assert calls["n"] == 5


def test_vehicle_row_carries_thumbnail_and_attribution():
    cfg = {
        "id": 164,
        "name": "Falcon 9",
        "image": {
            "image_url": "https://thespacedevs-dev.nyc3.digitaloceanspaces.com/media/images/f9.jpeg",
            "thumbnail_url": "https://thespacedevs-dev.nyc3.digitaloceanspaces.com/media/images/f9_thumb.jpeg",
            "credit": "SpaceX",
            "license": {"name": "CC BY-NC 2.0", "link": "https://creativecommons.org/licenses/by-nc/2.0/"},
        },
    }
    row = m.vehicle_row(cfg, None)
    # Dev-bucket URLs are rewritten to the reliable prod CDN, thumbnails too.
    assert row["thumbnail_url"].startswith("https://thespacedevs-prod.")
    assert row["image_credit"] == "SpaceX"
    assert row["image_license_name"] == "CC BY-NC 2.0"
    assert row["image_license_url"].endswith("/by-nc/2.0/")


def test_vehicle_row_without_image_is_null_safe():
    row = m.vehicle_row({"id": 1, "name": "X"}, None)
    assert row["thumbnail_url"] is None and row["image_credit"] is None


def test_tally_reports_unchanged_separately():
    rows = [{"name": "a"}, {"name": "b"}, {"name": "c"}]
    added, updated, details = _tally(rows, [("1", "inserted"), ("2", "updated"), (None, "unchanged")])
    assert (added, updated, details["unchanged"]) == (1, 1, 1)
    assert details["added_items"] == ["a"] and details["updated_items"] == ["b"]
