"""Accurately link satellites to launch events using the COSPAR designator.

Every object shares a COSPAR launch number (YYYY-NNN) with the rest of its
launch, so all objects of one COSPAR group must map to exactly ONE launch_event.
Date-only matching violated this (mixing different launches on busy days). Here:

  1. group satellites by COSPAR prefix,
  2. score each group against same-date (±1) launch_events, boosting provider/
     constellation name matches,
  3. greedily assign best score first, one event per group (bijective),
  4. groups with no confident match are left unlinked (honest, not guessed).

Run:  python -m src.seed.link_launches
"""
from __future__ import annotations

import logging
import re
from collections import Counter, defaultdict
from datetime import timedelta

from src.db.pool import cursor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("link")

_PREFIX = re.compile(r"^(\d{4}-\d{3})")


def prefix(cospar: str | None) -> str | None:
    m = _PREFIX.match(cospar or "")
    return m.group(1) if m else None


def link() -> tuple[int, int]:
    with cursor() as cur:
        cur.execute("""
            SELECT id, name, constellation, launch_date, cospar_id
            FROM satellites
            WHERE cospar_id ~ '^[0-9]{4}-[0-9]{3}' AND launch_date IS NOT NULL
        """)
        sats = cur.fetchall()

        groups: dict[str, dict] = defaultdict(
            lambda: {"ids": [], "tokens": set(), "dates": Counter()}
        )
        for s in sats:
            p = prefix(s["cospar_id"])
            if not p:
                continue
            g = groups[p]
            g["ids"].append(s["id"])
            g["dates"][s["launch_date"]] += 1
            if s["constellation"]:
                g["tokens"].add(s["constellation"].lower())
            tok = re.split(r"[-\s]", s["name"] or "")[0].lower()
            if len(tok) > 2:
                g["tokens"].add(tok)

        cur.execute("""
            SELECT id, lower(name) AS name, launch_time::date AS d
            FROM launch_events
            WHERE launch_time IS NOT NULL AND agency_id IS NOT NULL
        """)
        events_by_date: dict[object, list] = defaultdict(list)
        for e in cur.fetchall():
            events_by_date[e["d"]].append(e)

        # Score every (group, candidate event) pair.
        pairs: list[tuple[int, str, str]] = []
        for p, g in groups.items():
            gdate = g["dates"].most_common(1)[0][0]
            for delta in (0, -1, 1):
                for e in events_by_date.get(gdate + timedelta(days=delta), []):
                    name_match = any(t in e["name"] for t in g["tokens"])
                    score = (2 if delta == 0 else 0) + (3 if name_match else 0)
                    if score >= 2:
                        pairs.append((score, p, e["id"]))
        pairs.sort(key=lambda x: -x[0])

        assigned: dict[str, str] = {}
        used: set = set()
        for score, p, eid in pairs:
            if p in assigned or eid in used:
                continue
            assigned[p] = eid
            used.add(eid)

        # Apply: every sat in a group → its event (or NULL when unmatched).
        cur.execute("CREATE TEMP TABLE link_stage(sat_id uuid, le_id uuid) ON COMMIT DROP")
        with cur.copy("COPY link_stage (sat_id, le_id) FROM STDIN") as cp:
            for p, g in groups.items():
                eid = assigned.get(p)
                for sid in g["ids"]:
                    cp.write_row((sid, eid))
        cur.execute("UPDATE satellites s SET launch_event_id = st.le_id FROM link_stage st WHERE s.id = st.sat_id")

        linked = sum(len(g["ids"]) for p, g in groups.items() if p in assigned)
        log.info("COSPAR groups: %d, matched: %d, satellites linked: %d", len(groups), len(assigned), linked)
        return len(assigned), linked


if __name__ == "__main__":
    link()
