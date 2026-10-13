"""Run every intel job once, recording each outcome in sync_logs.

The scheduled workflow used to run these as `python -m src.x || echo "failed"`:
a failure was visible only by reading that run's Actions log, and never in the
freshness data the site and admin views read. Each job is still isolated (one
failing doesn't stop the others), but now leaves a row either way.

Run:  python -m src.run      (exit 1 only if every job failed)
"""
from __future__ import annotations

import json
import logging
import sys
import time

from src import conjunctions, reentry, spaceweather
from src.db import cursor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("intel.run")

JOBS = [
    ("intel-spaceweather", spaceweather.compute),
    ("intel-reentry", reentry.compute),
    ("intel-conjunctions", conjunctions.compute),
]


def _record(job: str, status: str, details: dict) -> None:
    try:
        with cursor() as cur:
            cur.execute(
                "INSERT INTO sync_logs (job_name, status, records_added, records_updated, details) VALUES (%s, %s, 0, %s, %s)",
                (job, status, details.get("count", 0) if isinstance(details.get("count"), int) else 0, json.dumps(details, default=str)),
            )
    except Exception as exc:  # logging must never mask the job's own outcome
        log.error("could not record %s in sync_logs: %s", job, exc)


def main() -> int:
    failures = 0
    for job, fn in JOBS:
        t = time.perf_counter()
        try:
            result = fn()
            details = {"result": result} if not isinstance(result, int) else {"count": result}
            status = "success"
            log.info("OK   %s", job)
        except Exception as exc:
            failures += 1
            details = {"error": str(exc)[:500]}
            status = "failure"
            log.exception("FAIL %s", job)
        details["duration_seconds"] = round(time.perf_counter() - t, 2)
        _record(job, status, details)
    return 1 if failures == len(JOBS) else 0


if __name__ == "__main__":
    sys.exit(main())
