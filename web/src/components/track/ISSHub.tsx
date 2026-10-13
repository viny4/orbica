"use client";

import { useState } from "react";
import Link from "next/link";

const EARTH_RADIUS_KM = 6371;

// ISS panel for the live tracker. Every number here is derived from the
// station's real orbit (SGP4 from the newest TLE). It used to show randomised
// "cabin telemetry" and a hard-coded 2022 crew list as if they were live; both
// were invented, so they're gone. The NASA stream is real and loads on demand.
export default function ISSHub({ velocity, altitude, onClose }: { velocity: number; altitude: number; onClose: () => void }) {
  const [tab, setTab] = useState<"orbit" | "feed">("orbit");

  const hasFix = velocity > 0 && altitude > 0;
  const periodMin = hasFix ? (2 * Math.PI * (EARTH_RADIUS_KM + altitude)) / velocity / 60 : null;
  const rows: [string, string][] = hasFix
    ? [
        ["Velocity", `${Math.round(velocity * 3600).toLocaleString("en-US")} km/h`],
        ["Altitude", `${altitude.toFixed(1)} km`],
        ["Orbital period", `${periodMin!.toFixed(1)} min`],
        ["Orbits per day", (1440 / periodMin!).toFixed(2)],
        ["Sunrises per day", String(Math.round(1440 / periodMin!))],
      ]
    : [["Status", "Propagating…"]];

  return (
    <div className="absolute bottom-16 right-4 z-20 flex w-[min(340px,calc(100%-2rem))] flex-col border border-accent/30 bg-black/80 shadow-2xl backdrop-blur-md lg:bottom-4">
      <div className="flex items-center justify-between border-b border-line bg-white/[0.02] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-3">International Space Station</span>
        </div>
        <button onClick={onClose} className="p-1 text-ink-3 transition-colors hover:text-ink" aria-label="Close ISS panel">
          ✕
        </button>
      </div>

      <div className="flex border-b border-line" role="tablist" aria-label="ISS panel">
        {(["orbit", "feed"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 border-r border-line py-2.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors last:border-r-0 ${
              tab === t ? "bg-white/[0.04] text-accent" : "text-ink-3 hover:text-ink-2"
            }`}
          >
            {t === "orbit" ? "Orbit" : "Live video"}
          </button>
        ))}
      </div>

      <div className="min-h-[200px] p-4">
        {tab === "orbit" ? (
          <dl className="spec-list">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="space-y-2">
            <div className="relative aspect-video w-full overflow-hidden border border-line bg-black">
              <iframe
                src="https://www.youtube-nocookie.com/embed/live_stream?channel=UCLA_RMccEDojqM3HHiF454g"
                title="NASA live stream"
                className="absolute inset-0 h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <p className="text-center font-mono text-[9px] leading-relaxed text-ink-4">
              NASA&apos;s live stream. Video drops out when the station is between ground stations.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-line px-4 py-2.5 text-center">
        <Link href="/iss" className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent transition-colors hover:text-ink">
          ISS live page & pass predictions →
        </Link>
      </div>
    </div>
  );
}
