"""One-shot data refresh for cron — the same syncs Airflow would run.

Pulls fresh launches/rockets/agencies (LL2), active-satellite TLEs + key
constellations (CelesTrak), real news (SNAPI), relinks satellites to launches,
and rebuilds the year-summary view. Each step is isolated: one failing source
(e.g. a rate-limited API) logs an error but never blocks the rest.

Run directly:  python -m src.sync.refresh
Run by cron:   scripts/sync.sh  (every 4h)
"""
from __future__ import annotations

import logging
import sys
import time
from datetime import datetime, timedelta, timezone

# Recurring sync only needs recent + upcoming launches, not all of 1957→now.
# A 45-day lookback catches new launches and slipped schedules in a few pages,
# staying well under LL2's rate limit.
RECENT_DAYS = 45

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s"
)
log = logging.getLogger("sync")


def _step(name: str, fn, *args) -> bool:
    """Run one step, timing it and swallowing exceptions so the job continues."""
    t = time.perf_counter()
    try:
        fn(*args)
        log.info("OK   %-18s %.1fs", name, time.perf_counter() - t)
        return True
    except Exception:  # noqa: BLE001 — deliberately keep going on any source error
        log.exception("FAIL %-18s %.1fs", name, time.perf_counter() - t)
        return False


def main() -> int:
    from src.db.pool import refresh_year_summary
    from src.seed import articles, historical_seed, satellites_seed

    since = (datetime.now(timezone.utc) - timedelta(days=RECENT_DAYS)).strftime("%Y-%m-%d")
    log.info("---- refresh run start (launches since %s) ----", since)
    critical_ok = True

    # Core: launches + agencies + rockets (drives "new launch" updates).
    # Reference data still refreshes fully; only the launch scan is windowed.
    critical_ok &= _step("launches", lambda: historical_seed.main(launches_net_gte=since))

    # Live-tracker orbits: active set first, then the big constellations.
    critical_ok &= _step("tle-active", satellites_seed.seed_group, "active")
    for group in ("starlink", "gps-ops", "galileo", "oneweb"):
        _step(f"tle-{group}", satellites_seed.seed_group, group)

    # Tie new satellites back to their launch, refresh news, rebuild summary.
    _step("link-satellites", satellites_seed.link_satellites_to_launches)
    critical_ok &= _step("news", articles.ingest)
    _step("year-summary", refresh_year_summary)

    log.info("---- refresh run end (%s) ----", "ok" if critical_ok else "with errors")
    return 0 if critical_ok else 1


if __name__ == "__main__":
    sys.exit(main())
