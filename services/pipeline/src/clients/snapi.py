"""Spaceflight News API (SNAPI) client — real news articles, no auth.

Docs: https://api.spaceflightnewsapi.net/v4/docs/
"""
from __future__ import annotations

from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type


class SnapiClient:
    base = "https://api.spaceflightnewsapi.net/v4"

    def __init__(self) -> None:
        self._c = httpx.Client(
            headers={"User-Agent": "rocketpedia/0.1"}, timeout=30.0, follow_redirects=True
        )

    def close(self) -> None:
        self._c.close()

    def __enter__(self) -> "SnapiClient":
        return self

    def __exit__(self, *_e: object) -> None:
        self.close()

    @retry(
        retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TransportError)),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        stop=stop_after_attempt(4),
        reraise=True,
    )
    def _get(self, params: dict[str, Any]) -> list[dict[str, Any]]:
        r = self._c.get(f"{self.base}/articles/", params=params)
        r.raise_for_status()
        return r.json().get("results", [])

    def search(self, q: str, limit: int = 5) -> list[dict[str, Any]]:
        return self._get({"search": q, "limit": limit, "ordering": "-published_at"})

    def latest(self, limit: int = 40) -> list[dict[str, Any]]:
        return self._get({"limit": limit, "ordering": "-published_at"})
