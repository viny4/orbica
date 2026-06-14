"""Launch Library 2 (The Space Devs) client.

LL2 is paginated and aggressively rate-limited on the free tier, so every call
retries with exponential backoff and respects the `next` cursor.
Docs: https://ll.thespacedevs.com/2.3.0/swagger/
"""
from __future__ import annotations

import logging
from typing import Any, Iterator

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from src.config import settings

log = logging.getLogger("ll2")


class LL2Client:
    def __init__(self, base_url: str | None = None, api_key: str | None = None) -> None:
        self.base_url = (base_url or settings.ll2_base_url).rstrip("/")
        headers = {"User-Agent": "orbica/0.1 (+https://orbica.space)"}
        if api_key or settings.ll2_api_key:
            headers["Authorization"] = f"Token {api_key or settings.ll2_api_key}"
        self._client = httpx.Client(
            headers=headers, timeout=settings.request_timeout_s, follow_redirects=True
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "LL2Client":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    @retry(
        retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TransportError)),
        wait=wait_exponential(multiplier=2, min=2, max=120),
        stop=stop_after_attempt(6),
        reraise=True,
    )
    def _get(self, url: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        resp = self._client.get(url, params=params)
        if resp.status_code == 429:
            log.warning("LL2 rate-limited (429); backing off")
            resp.raise_for_status()
        resp.raise_for_status()
        return resp.json()

    def paginate(self, path: str, params: dict[str, Any] | None = None) -> Iterator[dict[str, Any]]:
        """Yield every result across all pages of a list endpoint."""
        params = dict(params or {})
        params.setdefault("limit", settings.ll2_page_size)
        url = f"{self.base_url}/{path.lstrip('/')}"
        page = 0
        while url:
            data = self._get(url, params=params if page == 0 else None)
            for item in data.get("results", []):
                yield item
            url = data.get("next")
            page += 1
            log.info("LL2 %s page %d (next=%s)", path, page, bool(url))

    # --- typed convenience iterators ---

    def agencies(self) -> Iterator[dict[str, Any]]:
        return self.paginate("agencies/", {"mode": "detailed"})

    def launcher_configs(self) -> Iterator[dict[str, Any]]:
        # Rocket vehicle configurations (Falcon 9, Soyuz 2.1a, ...).
        return self.paginate("launcher_configurations/", {"mode": "detailed"})

    def launches(self, net_gte: str = "1957-01-01") -> Iterator[dict[str, Any]]:
        # Historical + upcoming launches, oldest first.
        return self.paginate(
            "launches/",
            {"mode": "detailed", "net__gte": net_gte, "ordering": "net"},
        )

    def pads(self) -> Iterator[dict[str, Any]]:
        return self.paginate("pads/", {})
