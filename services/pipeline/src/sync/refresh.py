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


def log_sync(job_name: str, status: str, records_added: int = 0, records_updated: int = 0, details: dict | None = None) -> None:
    import json
    from src.db.pool import cursor
    try:
        with cursor() as cur:
            cur.execute(
                """
                INSERT INTO sync_logs (job_name, status, records_added, records_updated, details)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (job_name, status, records_added, records_updated, json.dumps(details or {}))
            )
    except Exception as exc:
        log.error("Failed to write sync log for %s: %s", job_name, exc)


def _step(name: str, fn, *args) -> bool:
    """Run one step, timing it and swallowing exceptions so the job continues."""
    t = time.perf_counter()
    added = 0
    updated = 0
    details = {}
    try:
        res = fn(*args)
        if isinstance(res, tuple) and len(res) >= 2:
            added = res[0]
            updated = res[1]
            if len(res) > 2:
                details = res[2]
        elif isinstance(res, dict):
            added = res.get("added", 0)
            updated = res.get("updated", 0)
            details = res.get("details", res)
        elif isinstance(res, int):
            updated = res
            
        duration = time.perf_counter() - t
        if isinstance(details, dict):
            details["duration_seconds"] = round(duration, 2)
        
        log.info("OK   %-18s %.1fs", name, duration)
        log_sync(name, "success", added, updated, details)
        return True
    except Exception as exc:
        duration = time.perf_counter() - t
        log.exception("FAIL %-18s %.1fs", name, duration)
        log_sync(name, "failure", 0, 0, {"error": str(exc), "duration_seconds": round(duration, 2)})
        return False


def main() -> int:
    from src.db.pool import refresh_year_summary
    from src.seed import articles, historical_seed, satellites_seed

    since = (datetime.now(timezone.utc) - timedelta(days=RECENT_DAYS)).strftime("%Y-%m-%d")
    log.info("---- refresh run start (launches since %s) ----", since)
    critical_ok = True

    # Core: launches + agencies + rockets (drives "new launch" updates).
    # Reference data still refreshes fully; only the launch scan is windowed.
    def run_launches():
        stats = historical_seed.main(launches_net_gte=since)
        added = sum(s["added"] for s in stats.values())
        updated = sum(s["updated"] for s in stats.values())
        return added, updated, stats

    critical_ok &= _step("launches", run_launches)

    # Live-tracker orbits: active set first, then the big constellations.
    critical_ok &= _step("tle-active", satellites_seed.seed_group, "active")
    for group in ("starlink", "gps-ops", "galileo", "oneweb", "glo-ops", "iridium-NEXT", "globalstar", "orbcomm", "beidou", "kuiper"):
        _step(f"tle-{group}", satellites_seed.seed_group, group)

    # Tie new satellites back to their launch, fill constellation specs, refresh
    # news, rebuild summary.
    _step("link-satellites", satellites_seed.link_satellites_to_launches)
    _step("constellation-specs", satellites_seed.derive_constellation_specs)
    critical_ok &= _step("news", articles.ingest)
    _step("year-summary", refresh_year_summary)

    status = "success" if critical_ok else "failure"
    log_sync("refresh-run", status, 0, 0, {"message": "All steps executed", "critical_ok": critical_ok})
    log.info("---- refresh run end (%s) ----", "ok" if critical_ok else "with errors")
    return 0 if critical_ok else 1


if __name__ == "__main__":
    sys.exit(main())
