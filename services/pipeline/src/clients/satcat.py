"""CelesTrak SATCAT client — per-object launch & orbit metadata (no auth).

Each record carries the international designator (COSPAR), object type,
owner, launch date, launch site, decay date, and orbital parameters — exactly
the "where / when / what" a satellite page needs.
Docs: https://celestrak.org/satcat/
"""
from __future__ import annotations

import csv
import io
import logging
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from src.config import settings

log = logging.getLogger("satcat")


class SatcatClient:
    def __init__(self) -> None:
        self._c = httpx.Client(
            headers={"User-Agent": "orbica/0.1"},
            timeout=settings.request_timeout_s,
            follow_redirects=True,
        )

    def close(self) -> None:
        self._c.close()

    def __enter__(self) -> "SatcatClient":
        return self

    def __exit__(self, *_e: object) -> None:
        self.close()

    @retry(
        retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TransportError)),
        wait=wait_exponential(multiplier=2, min=2, max=60),
        stop=stop_after_attempt(5),
        reraise=True,
    )
    def records(self, group: str = "active") -> list[dict[str, Any]]:
        url = f"{settings.celestrak_base_url}/satcat/records.php"
        r = self._c.get(url, params={"GROUP": group, "FORMAT": "json"})
        r.raise_for_status()
        data = r.json()
        log.info("SATCAT group=%s → %d records", group, len(data))
        return data

    def full_csv(self) -> list[dict[str, Any]]:
        """The on-orbit catalogue CSV — includes deep-space probes the active
        TLE group omits."""
        r = self._c.get(f"{settings.celestrak_base_url}/pub/satcat.csv")
        r.raise_for_status()
        rows = list(csv.DictReader(io.StringIO(r.text)))
        log.info("SATCAT full CSV → %d records", len(rows))
        return rows

    def by_name(self, name: str) -> list[dict[str, Any]]:
        """Look up catalogue records by (substring) name — finds decayed /
        escaped missions (Cassini, New Horizons) not in any on-orbit feed."""
        try:
            r = self._c.get(
                f"{settings.celestrak_base_url}/satcat/records.php",
                params={"NAME": name, "FORMAT": "json"},
            )
            if r.status_code != 200:
                return []
            d = r.json()
            return d if isinstance(d, list) else []
        except (httpx.HTTPError, ValueError):
            return []
