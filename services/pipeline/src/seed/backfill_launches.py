"""Resumable, rate-limit-tolerant full launch backfill from production LL2.

The production endpoint holds the full 1957→now history (~7,900 launches) but
the free tier throttles hard (~15 requests/hour). A naive paginate crashes on
the first sustained 429. This backfill instead:

  * checkpoints the page offset to disk, so it resumes where it left off;
  * on 429, sleeps RATE_SLEEP and retries the SAME offset indefinitely — every
    few minutes the rolling rate window frees a slot, so it makes steady
    progress instead of dying;
  * upserts idempotently and refreshes year_summary periodically.

Designed to run unattended for a few hours. Safe to kill and restart.

Run:  python -m src.seed.backfill_launches
"""
from __future__ import annotations

import logging
import os
import time

import httpx

from src.config import settings
from src.db.pool import refresh_year_summary, upsert
from src.seed import mappers as m
from src.seed.historical_seed import _lookup_ll2_to_id

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("backfill")

PAGE_SIZE = 100
PAGE_SLEEP = 4.0       # polite gap between successful pages (seconds)
RATE_SLEEP = 300.0     # wait after a 429 before retrying the same offset
CHECKPOINT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "data", "seeds", ".launch_backfill_offset",
)
REFRESH_EVERY = 5      # refresh year_summary every N pages


def _read_offset() -> int:
    try:
        with open(CHECKPOINT) as f:
            return int(f.read().strip())
    except (FileNotFoundError, ValueError):
        return 0


def _write_offset(offset: int) -> None:
    os.makedirs(os.path.dirname(CHECKPOINT), exist_ok=True)
    with open(CHECKPOINT, "w") as f:
        f.write(str(offset))


def _client() -> httpx.Client:
    headers = {"User-Agent": "orbica/0.1 (+https://orbica.space)"}
    if settings.ll2_api_key:
        headers["Authorization"] = f"Token {settings.ll2_api_key}"
    return httpx.Client(
        base_url=settings.ll2_base_url,
        headers=headers,
        timeout=settings.request_timeout_s,
        follow_redirects=True,
    )


def backfill() -> None:
    rocket = _lookup_ll2_to_id("rocket_vehicles")
    agency = _lookup_ll2_to_id("agencies")
    site = _lookup_ll2_to_id("launch_sites")

    offset = _read_offset()
    log.info("resuming launch backfill at offset %d", offset)

    pages = 0
    total_upserted = 0
    with _client() as client:
        while True:
            params = {
                "mode": "detailed",
                "net__gte": "1957-01-01",
                "ordering": "net",
                "limit": PAGE_SIZE,
                "offset": offset,
            }
            try:
                resp = client.get("/launches/", params=params)
            except httpx.TransportError as exc:
                log.warning("network error (%s); retrying in %.0fs", exc, RATE_SLEEP)
                time.sleep(RATE_SLEEP)
                continue

            if resp.status_code == 429:
                wait = _retry_after(resp, RATE_SLEEP)
                log.info("429 at offset %d — waiting %.0fs for rate window", offset, wait)
                time.sleep(wait)
                continue
            if resp.status_code >= 500:
                log.warning("server %d at offset %d; retrying", resp.status_code, offset)
                time.sleep(RATE_SLEEP)
                continue
            resp.raise_for_status()

            data = resp.json()
            results = data.get("results", [])
            for launch in results:
                row = m.launch_row(
                    launch,
                    rocket_id=rocket.get(m.g(launch, "rocket", "configuration", "id")),
                    agency_id=agency.get(m.g(launch, "launch_service_provider", "id")),
                    site_id=site.get(m.g(launch, "pad", "id")),
                )
                if row["ll2_uuid"] is None:
                    continue
                upsert(
                    "launch_events", row, conflict="ll2_uuid",
                    update_cols=[k for k in row if k != "ll2_uuid"],
                )
                total_upserted += 1

            pages += 1
            offset += PAGE_SIZE
            _write_offset(offset)
            log.info(
                "page ok (offset→%d, +%d rows, %d total this run, count=%s)",
                offset, len(results), total_upserted, data.get("count"),
            )

            if pages % REFRESH_EVERY == 0:
                _safe_refresh()

            if not data.get("next") or len(results) < PAGE_SIZE:
                log.info("reached end of history at offset %d", offset)
                break

            time.sleep(PAGE_SLEEP)

    _safe_refresh()
    # Completed cleanly → clear checkpoint so a future run starts fresh.
    try:
        os.remove(CHECKPOINT)
    except FileNotFoundError:
        pass
    log.info("FULL BACKFILL COMPLETE — %d launches upserted this run", total_upserted)


def _retry_after(resp: httpx.Response, default: float) -> float:
    ra = resp.headers.get("Retry-After")
    if ra:
        try:
            return min(float(ra), 3600.0)
        except ValueError:
            pass
    return default


def _safe_refresh() -> None:
    try:
        refresh_year_summary()
    except Exception as exc:
        log.debug("year_summary refresh skipped: %s", exc)


if __name__ == "__main__":
    backfill()
