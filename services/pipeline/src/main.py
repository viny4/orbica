"""Pipeline control-plane API.

Exposes health + manual sync triggers so launches/TLEs can be refreshed on
demand (the same functions Airflow DAGs call on a schedule).
"""
from __future__ import annotations

import logging

from fastapi import BackgroundTasks, FastAPI

from src.db.pool import refresh_year_summary
from src.seed import historical_seed, satellites_seed

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="Rocketpedia Pipeline", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "rocketpedia-pipeline"}


@app.post("/sync/launches")
def sync_launches(bg: BackgroundTasks) -> dict[str, str]:
    bg.add_task(historical_seed.main)
    return {"status": "started", "job": "sync_launches"}


@app.post("/sync/satellites")
def sync_satellites(bg: BackgroundTasks, group: str = "active") -> dict[str, str]:
    bg.add_task(satellites_seed.seed_group, group)
    return {"status": "started", "job": "sync_satellites", "group": group}


@app.post("/sync/year-summary")
def sync_year_summary() -> dict[str, str]:
    refresh_year_summary()
    return {"status": "ok", "job": "refresh_year_summary"}
