"""CelesTrak client — fetches TLE / GP element sets for live satellites.

CelesTrak groups satellites (active, starlink, gps-ops, etc.). We pull the TLE
text format and parse it into (name, line1, line2) triples.
Docs: https://celestrak.org/NORAD/documentation/gp-data-formats.php
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Iterator

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from src.config import settings

log = logging.getLogger("celestrak")


@dataclass(frozen=True)
class TLE:
    name: str
    line1: str
    line2: str

    @property
    def norad_id(self) -> int:
        # NORAD catalog number is columns 3-7 of line 1.
        return int(self.line1[2:7])


class CelesTrakClient:
    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = (base_url or settings.celestrak_base_url).rstrip("/")
        self._client = httpx.Client(
            headers={"User-Agent": "orbica/0.1"},
            timeout=settings.request_timeout_s,
            follow_redirects=True,
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "CelesTrakClient":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    @retry(
        retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TransportError)),
        wait=wait_exponential(multiplier=2, min=2, max=60),
        stop=stop_after_attempt(5),
        reraise=True,
    )
    def _get_text(self, params: dict[str, str]) -> str:
        url = f"{self.base_url}/NORAD/elements/gp.php"
        resp = self._client.get(url, params=params)
        resp.raise_for_status()
        return resp.text

    def group(self, group: str = "active") -> Iterator[TLE]:
        """Yield TLEs for a CelesTrak GROUP (active, starlink, gps-ops, ...)."""
        text = self._get_text({"GROUP": group, "FORMAT": "tle"})
        yield from self._parse_tle_text(text)

    @staticmethod
    def _parse_tle_text(text: str) -> Iterator[TLE]:
        lines = [ln.rstrip() for ln in text.splitlines() if ln.strip()]
        # TLE files are 3-line stanzas: name, line1, line2.
        for i in range(0, len(lines) - 2, 3):
            name, l1, l2 = lines[i], lines[i + 1], lines[i + 2]
            if l1.startswith("1 ") and l2.startswith("2 "):
                yield TLE(name=name.strip(), line1=l1, line2=l2)
