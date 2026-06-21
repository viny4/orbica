"""ESA DISCOS client — real physical characteristics (mass, dimensions, shape).

DISCOS (discosweb.esoc.esa.int) rate-limits to ~100 requests/minute; this client
reads the X-Ratelimit-* headers and sleeps when the window is exhausted, and
honours 429 Retry-After. Token from DISCOS_TOKEN.
"""
from __future__ import annotations

import logging
import time
from typing import Iterator

import httpx

from src.config import settings

log = logging.getLogger("discos")
BASE = "https://discosweb.esoc.esa.int"


class DiscosClient:
    def __init__(self) -> None:
        if not settings.discos_token:
            raise RuntimeError("DISCOS_TOKEN not set in .env")
        self._c = httpx.Client(
            timeout=90.0, base_url=BASE,
            headers={"Authorization": f"Bearer {settings.discos_token}",
                     "DiscosWeb-Api-Version": "2"},
        )

    def __enter__(self) -> "DiscosClient":
        return self

    def __exit__(self, *_e: object) -> None:
        self._c.close()

    def _sleep_if_drained(self, resp: httpx.Response) -> None:
        try:
            remaining = int(resp.headers.get("x-ratelimit-remaining", "99"))
            reset = int(resp.headers.get("x-ratelimit-reset", "0"))
        except ValueError:
            return
        if remaining <= 1:
            wait = max(1, reset - int(time.time())) + 1
            log.info("rate-limit window drained; sleeping %ds", min(wait, 65))
            time.sleep(min(wait, 65))

    def objects_with_mass(self) -> Iterator[dict]:
        """Yield every catalogued object that has a known mass (paginated)."""
        path: str | None = "/api/objects"
        params: dict | None = {"filter": "ne(mass,null)", "page[size]": 100}
        pages = 0
        while path:
            # Resilient page fetch: retry transient network errors so one dropped
            # request can't abort a multi-minute pagination.
            resp = None
            for attempt in range(5):
                try:
                    resp = self._c.get(path, params=params)
                    break
                except (httpx.TransportError, httpx.TimeoutException) as exc:
                    if attempt == 4:
                        raise
                    log.warning("transient error (%s); retry %d", exc, attempt + 1)
                    time.sleep(2 * (attempt + 1))
            assert resp is not None
            if resp.status_code == 429:
                wait = int(resp.headers.get("retry-after", "60")) + 1
                log.info("429 rate-limited; sleeping %ds", min(wait, 65))
                time.sleep(min(wait, 65))
                continue
            resp.raise_for_status()
            body = resp.json()
            yield from body.get("data", [])
            pages += 1
            self._sleep_if_drained(resp)
            # links.next is a full path+query; pass it as the path with no extra params.
            path = (body.get("links") or {}).get("next")
            params = None
        log.info("DISCOS: fetched %d pages", pages)
