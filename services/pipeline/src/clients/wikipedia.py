"""Wikipedia client — real description + photo + source link for a spacecraft.

Uses the REST summary endpoint, with an opensearch fallback for names that
don't resolve directly.
"""
from __future__ import annotations

import re
from typing import Any
from urllib.parse import quote

import httpx


def clean_title(name: str) -> str:
    n = re.sub(r"\(.*?\)", "", name).strip()      # drop "(ZARYA)" etc.
    n = re.sub(r"\s+", " ", n)
    return n.title() if n.isupper() else n


class WikipediaClient:
    base = "https://en.wikipedia.org"

    def __init__(self) -> None:
        # Wikimedia requires a descriptive UA with a contact URL, else 403.
        self._c = httpx.Client(
            headers={"User-Agent": "Rocketpedia/0.1 (https://github.com/rocketpedia; rocketpedia@example.com)"},
            timeout=20.0,
            follow_redirects=True,
        )

    def close(self) -> None:
        self._c.close()

    def __enter__(self) -> "WikipediaClient":
        return self

    def __exit__(self, *_e: object) -> None:
        self.close()

    def summary(self, title: str) -> dict[str, Any] | None:
        try:
            r = self._c.get(f"{self.base}/api/rest_v1/page/summary/{quote(title)}")
        except httpx.HTTPError:
            return None
        if r.status_code != 200:
            return None
        d = r.json()
        if d.get("type") != "standard":
            return None
        extract = d.get("extract") or ""
        if len(extract) < 40:
            return None
        return {
            "title": d.get("title"),
            "extract": extract,
            "image": (d.get("thumbnail") or {}).get("source"),
            "url": (d.get("content_urls", {}).get("desktop", {}) or {}).get("page"),
        }

    def _search(self, q: str) -> str | None:
        try:
            r = self._c.get(
                f"{self.base}/w/api.php",
                params={"action": "query", "list": "search", "srsearch": q, "srlimit": 1, "format": "json"},
            )
            if r.status_code != 200:
                return None
            res = r.json().get("query", {}).get("search", [])
            return res[0]["title"] if res else None
        except httpx.HTTPError:
            return None

    def resolve(self, name: str, override: str | None = None, hint: str = "satellite spacecraft") -> dict[str, Any] | None:
        for cand in filter(None, [override, clean_title(name)]):
            s = self.summary(cand)
            if s:
                return s
        # last resort: full-text search (hint disambiguates rocket vs satellite),
        # then summarise the top hit
        hit = self._search(f"{clean_title(name)} {hint}")
        if hit:
            return self.summary(hit)
        return None
