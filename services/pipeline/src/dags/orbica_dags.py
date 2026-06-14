"""Airflow DAGs for scheduled Orbica syncs.

  sync_launches    every 6h   — refresh launches + agencies + rockets
  sync_tle         every 2h   — refresh active-satellite TLEs
  sync_satellites  daily      — refresh full satellite catalog + relink

Place/symlink this file under the Airflow dags folder (see infra/airflow).
"""
from __future__ import annotations

from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator

from src.db.pool import refresh_year_summary
from src.seed import historical_seed, satellites_seed

default_args = {
    "owner": "orbica",
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
}


def _sync_launches() -> None:
    historical_seed.main()


def _sync_tle() -> None:
    satellites_seed.seed_group("active")


def _sync_satellites() -> None:
    for group in ("active", "starlink", "gps-ops", "galileo", "oneweb"):
        satellites_seed.seed_group(group)
    satellites_seed.link_satellites_to_launches()
    refresh_year_summary()


with DAG(
    "sync_launches",
    default_args=default_args,
    schedule="0 */6 * * *",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=["orbica"],
) as sync_launches_dag:
    PythonOperator(task_id="sync_launches", python_callable=_sync_launches)

with DAG(
    "sync_tle",
    default_args=default_args,
    schedule="0 */2 * * *",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=["orbica"],
) as sync_tle_dag:
    PythonOperator(task_id="sync_tle", python_callable=_sync_tle)

with DAG(
    "sync_satellites",
    default_args=default_args,
    schedule="0 3 * * *",
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=["orbica"],
) as sync_satellites_dag:
    PythonOperator(task_id="sync_satellites", python_callable=_sync_satellites)
