"use client";

import { useState, useEffect } from "react";

interface CrewMember {
  name: string;
  craft: string;
}

interface TelemetryStats {
  pressure: number;
  o2: number;
  co2: number;
  temp: number;
  power: number;
}

export default function ISSHub({
  velocity,
  altitude,
  onClose,
}: {
  velocity: number;
  altitude: number;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"status" | "crew" | "feed">("status");
  const [crew, setCrew] = useState<string[]>([]);
  const [loadingCrew, setLoadingCrew] = useState(true);

  // Simulated telemetry metrics that fluctuate slightly
  const [telemetry, setTelemetry] = useState<TelemetryStats>({
    pressure: 101.32,
    o2: 20.9,
    co2: 0.31,
    temp: 22.4,
    power: 118.6,
  });

  // Telemetry fluctuation effect
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry((prev) => ({
        pressure: Number((101.3 + (Math.random() - 0.5) * 0.15).toFixed(2)),
        o2: Number((20.9 + (Math.random() - 0.5) * 0.05).toFixed(2)),
        co2: Number((0.31 + (Math.random() - 0.5) * 0.02).toFixed(3)),
        temp: Number((22.4 + (Math.random() - 0.5) * 0.3).toFixed(1)),
        power: Number((118.5 + (Math.random() - 0.5) * 2.5).toFixed(1)),
      }));
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  // Fetch ISS Crew members
  useEffect(() => {
    if (activeTab !== "crew") return;
    setLoadingCrew(true);

    fetch("https://api.open-notify.org/astros.json")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.people)) {
          const issPeople = data.people
            .filter((p: CrewMember) => p.craft === "ISS" || p.craft === "ISS-ZARYA")
            .map((p: CrewMember) => p.name);
          setCrew(issPeople.length > 0 ? issPeople : FALLBACK_CREW);
        } else {
          setCrew(FALLBACK_CREW);
        }
        setLoadingCrew(false);
      })
      .catch(() => {
        setCrew(FALLBACK_CREW);
        setLoadingCrew(false);
      });
  }, [activeTab]);

  const FALLBACK_CREW = [
    "Kjell Lindgren (Commander)",
    "Robert Hines (Flight Engineer)",
    "Jessica Watkins (Flight Engineer)",
    "Samantha Cristoforetti (Flight Engineer)",
    "Oleg Artemyev (Flight Engineer)",
    "Denis Matveev (Flight Engineer)",
    "Sergey Korsakov (Flight Engineer)",
  ];

  return (
    <div className="absolute bottom-16 right-4 lg:bottom-4 lg:right-4 bg-black/80 backdrop-blur-md border border-[var(--color-space-accent-2)]/30 w-[350px] shadow-2xl z-20 flex flex-col transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-space-accent-2)] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-space-accent-2)]"></span>
          </span>
          <span className="text-[11px] tracking-[0.25em] uppercase text-white/50 font-mono">
            ISS Command Center
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white transition-colors p-1"
          aria-label="Close Command Center"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/15 bg-black/45">
        {(["status", "crew", "feed"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 text-[10px] tracking-[0.1em] uppercase py-2.5 transition-all font-mono border-r border-white/10 last:border-r-0 ${
              activeTab === tab
                ? "bg-white/[0.04] text-[var(--color-space-accent-2)] font-semibold shadow-inner"
                : "text-white/40 hover:text-white/70 hover:bg-white/[0.01]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 min-h-[220px] max-h-[350px] overflow-y-auto">
        {activeTab === "status" && (
          <div className="space-y-3.5">
            {/* Speed & Altitude */}
            <div className="grid grid-cols-2 gap-3 pb-3 border-b border-white/5 font-mono">
              <div>
                <div className="text-[9px] text-white/30 uppercase tracking-wider">Velocity</div>
                <div className="text-sm font-semibold text-white/85">
                  {velocity > 0 ? `${(velocity * 3600).toFixed(0)} km/h` : "27,560 km/h"}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-white/30 uppercase tracking-wider">Altitude</div>
                <div className="text-sm font-semibold text-white/85">
                  {altitude > 0 ? `${altitude.toFixed(1)} km` : "418.5 km"}
                </div>
              </div>
            </div>

            {/* Environmental Gauges */}
            <div className="space-y-2.5 font-mono text-xs">
              {/* Cabin Pressure */}
              <div>
                <div className="flex justify-between text-white/50 text-[10px] mb-1">
                  <span>Cabin Pressure</span>
                  <span className="text-white/85">{telemetry.pressure} kPa</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400/80 transition-all duration-1000"
                    style={{ width: `${(telemetry.pressure / 110) * 100}%` }}
                  />
                </div>
              </div>

              {/* Cabin Temperature */}
              <div>
                <div className="flex justify-between text-white/50 text-[10px] mb-1">
                  <span>Cabin Temperature</span>
                  <span className="text-white/85">{telemetry.temp} °C</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-400/80 transition-all duration-1000"
                    style={{ width: `${(telemetry.temp / 35) * 100}%` }}
                  />
                </div>
              </div>

              {/* Oxygen Concentration */}
              <div>
                <div className="flex justify-between text-white/50 text-[10px] mb-1">
                  <span>Oxygen (O₂) Level</span>
                  <span className="text-white/85">{telemetry.o2} %</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400/80 transition-all duration-1000"
                    style={{ width: `${(telemetry.o2 / 25) * 100}%` }}
                  />
                </div>
              </div>

              {/* Solar Array Power Generation */}
              <div>
                <div className="flex justify-between text-white/50 text-[10px] mb-1">
                  <span>Solar Array Power</span>
                  <span className="text-white/85">{telemetry.power} kW</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400/80 transition-all duration-1000"
                    style={{ width: `${(telemetry.power / 130) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "crew" && (
          <div className="space-y-2 select-none">
            {loadingCrew ? (
              <div className="text-center py-8 text-xs text-white/40 font-mono flex flex-col items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b border-t border-[var(--color-space-accent-2)]"></span>
                Querying Astros Registry…
              </div>
            ) : (
              <ul className="space-y-1.5 font-mono text-xs max-h-[220px] overflow-y-auto pr-1">
                {crew.map((member, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between px-3 py-2 border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors"
                  >
                    <span className="text-white/80 font-medium truncate">{member}</span>
                    <span className="text-[9px] text-[var(--color-space-accent-2)]/75 border border-[var(--color-space-accent-2)]/25 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                      Astronaut
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === "feed" && (
          <div className="space-y-2 select-none">
            <div className="relative aspect-video w-full border border-white/10 rounded-sm overflow-hidden bg-black">
              <iframe
                src="https://www.youtube.com/embed/live_stream?channel=UCLA_RMccEDojqM3HHiF454g"
                title="NASA Live ISS Stream"
                className="absolute inset-0 w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
            <div className="text-[9px] font-mono text-white/40 text-center leading-relaxed">
              NASA Live Earth-View Stream. Video is subject to momentary signal loss when passing through ground-station shadows.
            </div>
          </div>
        )}
      </div>

      {/* Footer Details Link */}
      <div className="px-4 py-2.5 border-t border-white/10 bg-white/[0.01] text-center">
        <a
          href="/satellites/iss-zarya"
          className="inline-block text-[10px] font-semibold tracking-[0.2em] uppercase text-[var(--color-space-accent-2)] hover:text-white transition-colors"
        >
          Detailed Orbit Profile →
        </a>
      </div>
    </div>
  );
}
