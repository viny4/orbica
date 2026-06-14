"""Rocketpedia Intel — control plane.

Computes original "space intelligence" from the TLE catalogue + space-weather
feeds (conjunctions, reentry watch, geomagnetic conditions) and writes it to the
DB, which the Go API serves. Endpoints trigger refreshes; in production these run
on a schedule (Airflow/cron).
"""
from __future__ import annotations

import logging

from fastapi import BackgroundTasks, FastAPI

from src import conjunctions, reentry, spaceweather

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="Rocketpedia Intel", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "rocketpedia-intel"}


@app.post("/refresh/reentry")
def refresh_reentry() -> dict:
    return {"decaying": reentry.compute()}


@app.post("/refresh/spaceweather")
def refresh_weather() -> dict:
    return spaceweather.compute()


@app.post("/refresh/conjunctions")
def refresh_conjunctions(bg: BackgroundTasks) -> dict:
    bg.add_task(conjunctions.compute)
    return {"status": "started", "job": "conjunctions"}


@app.post("/refresh/all")
def refresh_all(bg: BackgroundTasks) -> dict:
    reentry.compute()
    spaceweather.compute()
    bg.add_task(conjunctions.compute)
    return {"status": "reentry+weather done, conjunctions running"}
