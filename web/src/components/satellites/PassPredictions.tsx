"use client";

import { useState } from "react";
import * as satellite from "satellite.js";

interface Pass {
  start: Date;
  peak: Date;
  end: Date;
  maxEl: number;
  startAz: number; // compass bearing where it rises (deg from N)
  peakAz: number; // bearing at highest point
  endAz: number; // bearing where it sets
}
type Status = "idle" | "locating" | "computing" | "done" | "denied" | "error";

// 16-point compass label for a bearing in degrees (0 = due north, clockwise).
const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
function dir(azDeg: number): string {
  return COMPASS[Math.round(((azDeg % 360) + 360) % 360 / 22.5) % 16];
}

// "When and where in the sky can I see this satellite from where I'm standing?"
// Computes the next passes above 10° elevation over the next 24h from the
// browser's location, entirely client-side via SGP4 look-angles — including the
// compass direction it rises, peaks and sets, so you know which way to look.
export function PassPredictions({ line1, line2 }: { line1: string; line2: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [passes, setPasses] = useState<Pass[]>([]);
  const [place, setPlace] = useState<string>("");
  const [coords, setCoords] = useState<string>("");

  // Best-effort reverse geocode (no API key — BigDataCloud's client endpoint).
  // Tells the user the nearest town + region so "from your location" is concrete.
  const resolvePlace = async (lat: number, lng: number) => {
    try {
      const r = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      );
      if (!r.ok) return;
      const j = await r.json();
      const parts = [j.city || j.locality, j.principalSubdivision, j.countryName].filter(Boolean);
      if (parts.length) setPlace(parts.join(", "));
    } catch {
      /* keep coords-only label */
    }
  };

  const compute = (lat: number, lng: number) => {
    setStatus("computing");
    setCoords(`${lat.toFixed(2)}°, ${lng.toFixed(2)}°`);
    void resolvePlace(lat, lng);
    try {
      const D2R = Math.PI / 180;
      const R2D = 180 / Math.PI;
      const satrec = satellite.twoline2satrec(line1, line2);
      const observer = { latitude: lat * D2R, longitude: lng * D2R, height: 0.1 };
      const found: Pass[] = [];
      let inPass = false;
      let start: Date | null = null;
      let startAz = 0;
      let lastAz = 0;
      let peak = 0;
      let peakAt: Date | null = null;
      let peakAz = 0;
      const now = Date.now();
      for (let t = 0; t < 24 * 3600; t += 30) {
        const when = new Date(now + t * 1000);
        const pv = satellite.propagate(satrec, when);
        if (!pv || typeof pv.position === "boolean" || !pv.position) continue;
        const gmst = satellite.gstime(when);
        const ecf = satellite.eciToEcf(pv.position as satellite.EciVec3<number>, gmst);
        const look = satellite.ecfToLookAngles(observer, ecf);
        const elDeg = look.elevation * R2D;
        const azDeg = ((look.azimuth * R2D) % 360 + 360) % 360;
        lastAz = azDeg;
        if (elDeg > 10) {
          if (!inPass) {
            inPass = true;
            start = when;
            startAz = azDeg;
            peak = elDeg;
            peakAt = when;
            peakAz = azDeg;
          } else if (elDeg > peak) {
            peak = elDeg;
            peakAt = when;
            peakAz = azDeg;
          }
        } else if (inPass) {
          inPass = false;
          if (start && peakAt)
            found.push({
              start,
              peak: peakAt,
              end: when,
              maxEl: Math.round(peak),
              startAz,
              peakAz,
              endAz: azDeg,
            });
          if (found.length >= 6) break;
        }
      }
      // If a pass is still in progress at the 24h horizon, close it out.
      if (inPass && start && peakAt && found.length < 6) {
        found.push({
          start,
          peak: peakAt,
          end: new Date(now + 24 * 3600 * 1000),
          maxEl: Math.round(peak),
          startAz,
          peakAz,
          endAz: lastAz,
        });
      }
      setPasses(found);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setStatus("error");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => compute(pos.coords.latitude, pos.coords.longitude),
      () => setStatus("denied"),
      { timeout: 10000, enableHighAccuracy: false },
    );
  };

  const fmt = (d: Date) =>
    d.toLocaleString("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit" });
  const dur = (a: Date, b: Date) => `${Math.round((b.getTime() - a.getTime()) / 60000)} min`;
  // "very high" overhead passes barely move in azimuth — call those out.
  const quality = (el: number) => (el >= 70 ? "near overhead" : el >= 40 ? "high" : el >= 20 ? "moderate" : "low");

  return (
    <section className="mt-16">
      <h2 className="text-[11px] tracking-[0.3em] uppercase text-white/45 mb-4 border-b border-white/10 pb-3">
        Visible passes from your location
      </h2>

      {status === "idle" && (
        <button
          onClick={locate}
          className="border border-white/70 px-6 py-3 text-[11px] tracking-[0.25em] uppercase text-white hover:bg-white hover:text-black transition-colors"
        >
          Find passes near me
        </button>
      )}
      {status === "locating" && <p className="text-white/50 text-sm">Getting your location…</p>}
      {status === "computing" && <p className="text-white/50 text-sm">Computing passes…</p>}
      {status === "denied" && (
        <p className="text-white/45 text-sm">Location permission denied — can&apos;t compute local passes.</p>
      )}
      {status === "error" && <p className="text-white/45 text-sm">Couldn&apos;t compute passes for this object.</p>}

      {status === "done" && (
        <>
          <p className="text-[11px] tracking-[0.2em] uppercase text-white/35 font-mono mb-1">
            Next 24h · {place ? `near ${place}` : `from ${coords}`} · above 10° elevation
          </p>
          {place && (
            <p className="text-[10px] tracking-[0.15em] uppercase text-white/25 font-mono mb-4">{coords}</p>
          )}
          {passes.length === 0 ? (
            <p className="text-white/45 text-sm">No passes above 10° in the next 24 hours from your location.</p>
          ) : (
            <>
              <ul className="divide-y divide-white/10 border-y border-white/10">
                {passes.map((p, i) => (
                  <li key={i} className="flex items-start justify-between gap-4 py-3 text-sm">
                    <div>
                      <div className="font-mono">
                        {fmt(p.start)} <span className="text-white/30">→</span> {fmt(p.end)}
                        <span className="text-white/35 ml-2">({dur(p.start, p.end)})</span>
                      </div>
                      <div className="text-[11px] tracking-[0.12em] uppercase text-white/45 mt-1 font-mono">
                        rises <span className="text-white/75">{dir(p.startAz)}</span>
                        <span className="text-white/25"> → </span>
                        highest <span className="text-white/75">{dir(p.peakAz)}</span>
                        <span className="text-white/25"> → </span>
                        sets <span className="text-white/75">{dir(p.endAz)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-[var(--color-space-accent-2)]">peak {p.maxEl}°</div>
                      <div className="text-[10px] tracking-[0.15em] uppercase text-white/35 mt-1">
                        {quality(p.maxEl)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] leading-relaxed text-white/30 mt-3">
                Face the “rises” direction and follow the satellite as it climbs toward “highest” (its peak
                elevation) and drops to “sets”. Higher peak elevation = brighter and easier to spot. A pass is
                visible across a wide region, so these directions apply to anyone near {place || "your location"}.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
