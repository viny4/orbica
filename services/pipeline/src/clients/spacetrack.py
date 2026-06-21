"""Space-Track.org client — authenticated SATCAT access.

Space-Track rate-limits hard (≤30 req/min, ≤300 req/hr) and asks clients to pull
in bulk rather than per-object, so we fetch the whole SATCAT in ONE query and
match locally. Credentials come from SPACE_TRACK_USER / SPACE_TRACK_PASS.
"""
from __future__ import annotations

import logging

import httpx

from src.config import settings

log = logging.getLogger("spacetrack")

BASE = "https://www.space-track.org"


class SpaceTrackClient:
    def __init__(self) -> None:
        self._c = httpx.Client(timeout=120.0, follow_redirects=True,
                               headers={"User-Agent": "orbica/0.1"})
        self._authed = False

    def __enter__(self) -> "SpaceTrackClient":
        self.login()
        return self

    def __exit__(self, *_e: object) -> None:
        self._c.close()

    def login(self) -> None:
        if not settings.space_track_user or not settings.space_track_pass:
            raise RuntimeError("SPACE_TRACK_USER / SPACE_TRACK_PASS not set in .env")
        r = self._c.post(
            f"{BASE}/ajaxauth/login",
            data={"identity": settings.space_track_user, "password": settings.space_track_pass},
        )
        r.raise_for_status()
        if "failed" in r.text.lower():
            raise RuntimeError("Space-Track login failed — check credentials")
        self._authed = True
        log.info("Space-Track login OK")

    def satcat(self) -> list[dict]:
        """The full satellite catalogue: NORAD id, decay date, RCS size, etc.

        One bulk query (the catalogue is ~60k rows). Returns the latest record
        per object (CURRENT='Y').
        """
        if not self._authed:
            self.login()
        url = (
            f"{BASE}/basicspacedata/query/class/satcat/CURRENT/Y/"
            "orderby/NORAD_CAT_ID asc/format/json"
        )
        r = self._c.get(url)
        r.raise_for_status()
        rows = r.json()
        log.info("Space-Track SATCAT: %d records", len(rows))
        return rows
