"""Wikidata client — NORAD catalogue number → Commons image, in one query.

The Query Service answers SPARQL over the whole of Wikidata, so the entire
NORAD→image mapping arrives in a single request rather than one lookup per
satellite.
Docs: https://query.wikidata.org/
"""
from __future__ import annotations

import csv
import io
import logging

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

log = logging.getLogger("wikidata")

# P377 = NORAD Satellite Catalog Number, P18 = image. (P2956 looks similar but
# is the NAIF id, which is negative for spacecraft — not a catalogue number.)
_SATELLITE_IMAGES_SPARQL = "SELECT ?scn ?img WHERE { ?s wdt:P377 ?scn ; wdt:P18 ?img . }"

# Commons serves a resized copy when a width is given, and *refuses* bot access
# to the full-resolution original. These are card thumbnails, so ask for a size.
THUMB_WIDTH = 400


def thumbnail_url(commons_url: str, width: int = THUMB_WIDTH) -> str:
    # Wikidata hands back the http:// form of Special:FilePath; serve https so
    # the browser doesn't eat a redirect (or a mixed-content block) per card.
    url = commons_url.replace("http://", "https://", 1)
    return f"{url}?width={width}"


class WikidataClient:
    base = "https://query.wikidata.org/sparql"

    def __init__(self) -> None:
        # Wikimedia's robot policy wants a contact URL *with a scheme* or an
        # e-mail in the UA; a bare domain still gets a blanket 403.
        self._c = httpx.Client(
            headers={
                "User-Agent": "Orbica/1.0 (satellite encyclopedia; https://github.com/viny4/orbica; orbica@example.com)",
                "Accept": "text/csv",
            },
            # A whole-graph scan is far slower than a REST call, so this timeout
            # is deliberately looser than settings.request_timeout_s.
            timeout=90.0,
            follow_redirects=True,
        )

    def close(self) -> None:
        self._c.close()

    def __enter__(self) -> "WikidataClient":
        return self

    def __exit__(self, *_e: object) -> None:
        self.close()

    @retry(
        retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TransportError)),
        wait=wait_exponential(multiplier=2, min=2, max=20),
        stop=stop_after_attempt(3),
        reraise=True,
    )
    def _csv(self, query: str) -> list[dict[str, str]]:
        r = self._c.get(self.base, params={"query": query})
        r.raise_for_status()
        return list(csv.DictReader(io.StringIO(r.text)))

    def satellite_images(self, width: int = THUMB_WIDTH) -> dict[int, str]:
        """NORAD id → Commons thumbnail URL for every imaged satellite."""
        out: dict[int, str] = {}
        rows = self._csv(_SATELLITE_IMAGES_SPARQL)
        # ~10% of entities carry several images; sort first so the pick is
        # stable across runs regardless of the order SPARQL returns them in.
        for row in sorted(rows, key=lambda r: (r.get("scn") or "", r.get("img") or "")):
            scn, img = (row.get("scn") or "").strip(), (row.get("img") or "").strip()
            if not scn.isdigit() or "Special:FilePath/" not in img:
                continue
            out.setdefault(int(scn), thumbnail_url(img, width))
        log.info("Wikidata P377+P18 → %d rows, %d distinct NORAD ids", len(rows), len(out))
        return out
