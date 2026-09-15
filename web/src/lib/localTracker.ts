// Client-side orbit propagation for the live tracker.
//
// Normally positions stream from the Go hub over WebSocket. When that server
// isn't reachable, the browser can do the same job itself: pull every current
// TLE once from Supabase (~2.3 MB) and run SGP4 locally. Measured on 16,209
// satellites: 71 ms to parse, ~18 ms to propagate the whole catalogue — so a
// 10 s tick costs ~0.2% of a core, and after the initial fetch it uses no
// bandwidth at all (the stream cost ~68 MB per viewer-hour).
//
// Time-machine offsets are handled here too, and more directly than over the
// wire: we simply propagate to `now + offset`.

import {
  twoline2satrec,
  propagate,
  gstime,
  eciToGeodetic,
  degreesLat,
  degreesLong,
  type SatRec,
} from "satellite.js";
import type { LivePos } from "./livePositions";
import { rpcFetch, rpcEnabled } from "./rpc";

export { rpcEnabled };

type Entry = { norad: number; rec: SatRec };

let cache: Entry[] | null = null;
let loading: Promise<Entry[]> | null = null;

/** Fetch + parse every current TLE. Cached for the page's lifetime. */
export function loadCatalog(): Promise<Entry[]> {
  if (cache) return Promise.resolve(cache);
  if (loading) return loading;

  loading = (async () => {
    const res = await rpcFetch("/all-tles");
    if (!res.ok) throw new Error(`TLE fetch → ${res.status}`);
    const rows = (await res.json()) as [number, string, string][];
    const out: Entry[] = [];
    for (const [norad, l1, l2] of rows) {
      try {
        const rec = twoline2satrec(l1, l2);
        // satrec.error is non-zero for TLEs SGP4 can't initialise.
        if (!rec.error) out.push({ norad, rec });
      } catch {
        /* skip unparseable element sets */
      }
    }
    cache = out;
    return out;
  })();

  return loading;
}

/** Propagate the whole catalogue to one instant. */
export function positionsAt(entries: Entry[], when: Date): LivePos[] {
  const gmst = gstime(when);
  const out: LivePos[] = [];
  for (const { norad, rec } of entries) {
    const pv = propagate(rec, when);
    const p = pv?.position;
    const v = pv?.velocity;
    if (!p || typeof p === "boolean") continue;
    const geo = eciToGeodetic(p, gmst);
    out.push({
      norad_id: norad,
      lat: degreesLat(geo.latitude),
      lng: degreesLong(geo.longitude),
      altitude_km: geo.height,
      velocity_km_s:
        v && typeof v !== "boolean" ? Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) : 0,
    });
  }
  return out;
}

/**
 * Run the local tracker until the returned stop() is called.
 * `getOffsetSeconds` is read each tick so the time machine keeps working.
 */
export function startLocalTracker(
  onPositions: (p: LivePos[]) => void,
  getOffsetSeconds: () => number,
  intervalMs = 10_000,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  loadCatalog()
    .then((entries) => {
      if (stopped) return;
      const tick = () => {
        const when = new Date(Date.now() + getOffsetSeconds() * 1000);
        onPositions(positionsAt(entries, when));
      };
      tick();
      timer = setInterval(tick, intervalMs);
    })
    .catch(() => {
      /* leave the caller's status as-is; nothing to show */
    });

  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
  };
}
