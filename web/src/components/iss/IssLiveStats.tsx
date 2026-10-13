"use client";

// Live ISS position readout, propagated client-side from the latest TLE once a
// second (on the shared page clock). Numbers only — the 3D view carries the visual.

import { propagateTLE } from "@/components/three/geo";
import { useNow } from "@/hooks/useNow";
import { StatusDot } from "@/components/ui";

function hemi(v: number, pos: string, neg: string) {
  return `${Math.abs(v).toFixed(2)}° ${v >= 0 ? pos : neg}`;
}

export default function IssLiveStats({ line1, line2 }: { line1: string; line2: string }) {
  const now = useNow();
  const fix = now ? propagateTLE(line1, line2, new Date(now)) : null;

  const tiles: [string, string][] = fix
    ? [
        ["Latitude", hemi(fix.lat, "N", "S")],
        ["Longitude", hemi(fix.lng, "E", "W")],
        ["Altitude", `${fix.altKm.toFixed(0)} km`],
        ["Speed", `${Math.round(fix.speedKmS * 3600).toLocaleString("en-US")} km/h`],
      ]
    : [
        ["Latitude", "…"],
        ["Longitude", "…"],
        ["Altitude", "…"],
        ["Speed", "…"],
      ];

  return (
    <div>
      <div className="mb-4 flex items-center gap-2.5">
        <StatusDot tone="success" pulse />
        <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-3">Live position · updates every second</span>
      </div>
      <div className="tile-grid grid-cols-2 md:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="tile p-5">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-4">{label}</div>
            <div className="font-mono text-2xl tabular-nums md:text-3xl">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
