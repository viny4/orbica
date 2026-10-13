"use client";

import { useEffect, useMemo, useState } from "react";
import { useInView } from "@/components/three/useInView";
import { useNow } from "@/hooks/useNow";
import type { GeoPos } from "@/components/three/geo";

type Geo = typeof import("@/components/three/geo");

const W = 360;
const H = 180;
const x = (lng: number) => ((lng + 180) / 360) * W;
const y = (lat: number) => ((90 - lat) / 180) * H;

// Live ISS ground-track preview: where the station is now and where it goes in
// the next orbit, on a lat/long grid. Propagated in the browser from the newest
// TLE (same maths as the full tracker). satellite.js loads only once this card
// scrolls into view.
export default function IssMini({ line1, line2 }: { line1: string; line2: string }) {
  const { ref, armed } = useInView<HTMLDivElement>("100px");
  const [geo, setGeo] = useState<Geo | null>(null);
  const now = useNow();

  useEffect(() => {
    if (!armed || geo) return;
    let alive = true;
    import("@/components/three/geo").then((m) => alive && setGeo(m));
    return () => {
      alive = false;
    };
  }, [armed, geo]);

  // Next ~93 min of track, recomputed each minute.
  const minute = Math.floor(now / 60_000);
  const segments = useMemo(() => {
    if (!geo || !minute) return [] as string[];
    const start = minute * 60_000;
    const out: string[] = [];
    let seg: string[] = [];
    let prevLng: number | null = null;
    for (let i = 0; i <= 120; i++) {
      const p = geo.propagateTLE(line1, line2, new Date(start + i * 46_500));
      if (!p) continue;
      if (prevLng !== null && Math.abs(p.lng - prevLng) > 180) {
        if (seg.length > 1) out.push(seg.join(" "));
        seg = [];
      }
      seg.push(`${x(p.lng).toFixed(1)},${y(p.lat).toFixed(1)}`);
      prevLng = p.lng;
    }
    if (seg.length > 1) out.push(seg.join(" "));
    return out;
  }, [geo, minute, line1, line2]);

  const pos: GeoPos | null = geo && now ? geo.propagateTLE(line1, line2, new Date(now)) : null;

  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="ISS ground track for the next orbit">
        <rect width={W} height={H} fill="rgb(7 11 22 / 0.6)" />
        {[-60, -30, 0, 30, 60].map((lat) => (
          <line key={lat} x1="0" x2={W} y1={y(lat)} y2={y(lat)} stroke="rgb(148 170 220 / 0.09)" strokeDasharray={lat === 0 ? undefined : "2 4"} />
        ))}
        {[-120, -60, 0, 60, 120].map((lng) => (
          <line key={lng} y1="0" y2={H} x1={x(lng)} x2={x(lng)} stroke="rgb(148 170 220 / 0.09)" strokeDasharray={lng === 0 ? undefined : "2 4"} />
        ))}
        {segments.map((pts, i) => (
          <polyline key={i} points={pts} fill="none" stroke="#34d399" strokeOpacity="0.55" strokeWidth="1.2" strokeDasharray="3 3" />
        ))}
        {pos && (
          <g transform={`translate(${x(pos.lng)} ${y(pos.lat)})`}>
            <circle r="9" fill="#7df9ff" opacity="0.15" />
            <circle r="3.5" fill="#7df9ff" />
          </g>
        )}
      </svg>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-xs tabular-nums sm:grid-cols-4">
        {[
          ["Lat", pos ? `${Math.abs(pos.lat).toFixed(2)}° ${pos.lat >= 0 ? "N" : "S"}` : "…"],
          ["Lon", pos ? `${Math.abs(pos.lng).toFixed(2)}° ${pos.lng >= 0 ? "E" : "W"}` : "…"],
          ["Alt", pos ? `${pos.altKm.toFixed(0)} km` : "…"],
          ["Speed", pos ? `${Math.round(pos.speedKmS * 3600).toLocaleString("en-US")} km/h` : "…"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-[9px] uppercase tracking-[0.22em] text-ink-4">{k}</dt>
            <dd className="mt-0.5 text-ink-2">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
