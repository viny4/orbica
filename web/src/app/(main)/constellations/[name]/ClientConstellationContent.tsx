"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { type Satellite } from "@/lib/api";
import { WebGLGuard, WebGLFallback } from "@/components/three/WebGLGuard";

const ConstellationGlobe = dynamic(() => import("@/components/three/ConstellationGlobe"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center border border-line bg-white/[0.01] font-mono text-[11px] uppercase tracking-widest text-ink-4">
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
        <div className="tile-grid grid-cols-2">
          {cards.map((c, i) => (
            <div
              key={i}
              className="tile flex flex-col justify-between p-4"
            >
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-4">
                {c.label}
              </span>
              <span className="mt-2 text-xl font-light tabular-nums text-ink sm:text-2xl">
                {c.value}
              </span>
            </div>
          ))}
        </div>

        {/* List Section */}
        <div className="card flex flex-1 flex-col p-5">
          <div className="flex items-center justify-between mb-4 gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-4">
              Constellation Nodes ({filteredSatellites.length})
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name or NORAD..."
              className="field w-44 py-1.5 text-xs sm:w-60"
              aria-label="Filter satellites by name or NORAD id"
            />
          </div>

          {/* List Container */}
          <div className="max-h-[360px] flex-1 divide-y divide-line overflow-y-auto pr-1 lg:max-h-[380px]">
            {filteredSatellites.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between py-2.5 text-xs transition-colors [content-visibility:auto] [contain-intrinsic-size:auto_44px] hover:bg-white/[0.02]"
              >
                <div className="min-w-0">
                  <Link
                    href={`/satellites/${s.slug}`}
                    className="block truncate font-light text-ink transition-colors hover:text-accent"
                  >
                    {s.name}
                  </Link>
                  <span className="font-mono text-[10px] text-ink-4">
                    NORAD {s.norad_id || "—"} · {s.launch_date || "Unknown Date"}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-[10px] text-ink-3">
                    {s.orbit_type || "—"}
                  </span>
                  <span
                    className={`text-[9px] uppercase tracking-wider font-mono px-1.5 py-0.5 border ${
                      s.status?.toLowerCase() === "active"
                        ? "border-success/25 text-success"
                        : "border-line text-ink-4"
                    }`}
                  >
                    {s.status || "inactive"}
                  </span>
                </div>
              </div>
            ))}
            {filteredSatellites.length === 0 && (
              <div className="py-8 text-center text-xs italic text-ink-4">
                No matching satellites in this constellation
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right side: Globe */}
      <div className="flex flex-col h-[50vh] lg:h-full min-h-[400px]">
        <WebGLGuard fallback={<WebGLFallback className="border border-line" label="3D globe needs WebGL" />}>
          <ConstellationGlobe satellites={satellites} constellationName={constellationName} />
        </WebGLGuard>
      </div>
    </div>
  );
}
