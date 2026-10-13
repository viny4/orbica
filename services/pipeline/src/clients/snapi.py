"""Spaceflight News API (SNAPI) client — real news articles, no auth.

Docs: https://api.spaceflightnewsapi.net/v4/docs/
"""
from __future__ import annotations

from typing import Any

import httpx
from src.clients.http_retry import http_retry


class SnapiClient:
    base = "https://api.spaceflightnewsapi.net/v4"

    def __init__(self) -> None:
        self._c = httpx.Client(
            headers={"User-Agent": "orbica/0.1"}, timeout=30.0, follow_redirects=True
        )

    def close(self) -> None:
        self._c.close()

    def __enter__(self) -> "SnapiClient":
        return self

    def __exit__(self, *_e: object) -> None:
        self.close()

    # Transient errors only (429/5xx/network), honouring Retry-After — see http_retry.
    @http_retry(attempts=4, cap=30)
    def _get(self, params: dict[str, Any]) -> list[dict[str, Any]]:
        r = self._c.get(f"{self.base}/articles/", params=params)
        r.raise_for_status()
        return r.json().get("results", [])

    def search(self, q: str, limit: int = 5) -> list[dict[str, Any]]:
        return self._get({"search": q, "limit": limit, "ordering": "-published_at"})

    def latest(self, limit: int = 40) -> list[dict[str, Any]]:
        return self._get({"limit": limit, "ordering": "-published_at"})
