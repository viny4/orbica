"use client";

// Live ISS position readout, propagated client-side from the latest TLE once a
// second. Numbers only — the 3D view below carries the visual.

import { useEffect, useState } from "react";
import {
  twoline2satrec,
  propagate,
  gstime,
  eciToGeodetic,
  degreesLat,
  degreesLong,
} from "satellite.js";

interface Fix {
  lat: number;
  lon: number;
  altKm: number;
  speedKmh: number;
}

function compute(line1: string, line2: string): Fix | null {
  try {
    const satrec = twoline2satrec(line1, line2);
    const now = new Date();
    const pv = propagate(satrec, now);
    const pos = pv?.position;
    const vel = pv?.velocity;
    if (!pos || typeof pos === "boolean" || !vel || typeof vel === "boolean") return null;
    const gmst = gstime(now);
    const geo = eciToGeodetic(pos, gmst);
    const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2) * 3600; // km/s -> km/h
    return {
      lat: degreesLat(geo.latitude),
      lon: degreesLong(geo.longitude),
      altKm: geo.height,
      speedKmh: speed,
    };
  } catch {
    return null;
  }
}

function hemi(v: number, pos: string, neg: string) {
  return `${Math.abs(v).toFixed(2)}° ${v >= 0 ? pos : neg}`;
}

export default function IssLiveStats({ line1, line2 }: { line1: string; line2: string }) {
  const [fix, setFix] = useState<Fix | null>(null);

  useEffect(() => {
    const tick = () => setFix(compute(line1, line2));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [line1, line2]);

  const tiles: [string, string][] = fix
    ? [
        ["Latitude", hemi(fix.lat, "N", "S")],
        ["Longitude", hemi(fix.lon, "E", "W")],
        ["Altitude", `${fix.altKm.toFixed(0)} km`],
        ["Speed", `${Math.round(fix.speedKmh).toLocaleString()} km/h`],
      ]
    : [
        ["Latitude", "…"],
        ["Longitude", "…"],
        ["Altitude", "…"],
        ["Speed", "…"],
      ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[11px] tracking-[0.25em] uppercase text-white/50">
          Live position · updates every second
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="border border-white/10 bg-white/[0.03] p-5">
            <div className="text-[10px] tracking-[0.2em] uppercase text-white/40 mb-2">{label}</div>
            <div className="text-2xl md:text-3xl font-mono tabular-nums">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
