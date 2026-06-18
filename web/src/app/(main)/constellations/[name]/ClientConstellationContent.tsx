"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { type Satellite } from "@/lib/api";

const ConstellationGlobe = dynamic(() => import("@/components/three/ConstellationGlobe"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-white/[0.01] border border-white/10 grid place-items-center text-white/30 text-xs tracking-widest uppercase">
      Loading 3D space scene…
    </div>
  ),
});

interface Stats {
  total: number;
  active: number;
  altitude: string;
  inclination: string;
}

interface Props {
  satellites: Satellite[];
  stats: Stats;
  constellationName: string;
}

export default function ClientConstellationContent({ satellites, stats, constellationName }: Props) {
  const [search, setSearch] = useState("");

  const filteredSatellites = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return satellites;
    return satellites.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.norad_id && String(s.norad_id).includes(q))
    );
  }, [satellites, search]);

  const cards = [
    { label: "Total Satellites", value: stats.total.toLocaleString() },
    { label: "Active Nodes", value: stats.active.toLocaleString() },
    { label: "Altitude Shell", value: stats.altitude },
    { label: "Inclination", value: stats.inclination },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_48%] gap-8 items-stretch flex-1">
      {/* Left side: Stats & List */}
      <div className="flex flex-col space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {cards.map((c, i) => (
            <div
              key={i}
              className="border border-white/10 bg-white/[0.015] p-4 flex flex-col justify-between"
            >
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono">
                {c.label}
              </span>
              <span className="text-xl sm:text-2xl font-light text-white mt-2">
                {c.value}
              </span>
            </div>
          ))}
        </div>

        {/* List Section */}
        <div className="flex flex-col flex-1 border border-white/10 bg-[#04060b] p-5">
          <div className="flex items-center justify-between mb-4 gap-4">
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-mono">
              Constellation Nodes ({filteredSatellites.length})
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name or NORAD..."
              className="bg-black/60 border border-white/15 px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-[var(--color-space-accent-2)] w-48 sm:w-60"
            />
          </div>

          {/* List Container */}
          <div className="flex-1 overflow-y-auto max-h-[360px] lg:max-h-[380px] divide-y divide-white/5 pr-1">
            {filteredSatellites.map((s) => (
              <div
                key={s.id}
                className="py-2.5 flex items-center justify-between text-xs hover:bg-white/[0.01] transition-colors"
              >
                <div className="min-w-0">
                  <Link
                    href={`/satellites/${s.slug}`}
                    className="font-light text-white hover:text-[var(--color-space-accent-2)] transition-colors block truncate"
                  >
                    {s.name}
                  </Link>
                  <span className="text-[10px] font-mono text-white/35">
                    NORAD {s.norad_id || "—"} · {s.launch_date || "Unknown Date"}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] font-mono text-white/45">
                    {s.orbit_type || "—"}
                  </span>
                  <span
                    className={`text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 border ${
                      s.status?.toLowerCase() === "active"
                        ? "border-emerald-500/20 text-emerald-400"
                        : "border-white/10 text-white/40"
                    }`}
                  >
                    {s.status || "inactive"}
                  </span>
                </div>
              </div>
            ))}
            {filteredSatellites.length === 0 && (
              <div className="text-center py-8 text-white/30 text-xs italic">
                No matching satellites in this constellation
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right side: Globe */}
      <div className="flex flex-col h-[50vh] lg:h-full min-h-[400px]">
        <ConstellationGlobe
          satellites={satellites}
          constellationName={constellationName}
        />
      </div>
    </div>
  );
}
