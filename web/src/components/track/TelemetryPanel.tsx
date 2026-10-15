"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  propagateTLE,
  getOrbitalElements,
  isInEclipse,
  calculateDopplerShift,
  getFuturePasses,
  getBearing,
  getElevation,
  formatOrbitalElements,
  type GeoPos,
  type PassInfo,
} from "@/components/three/geo";

export interface TrackedSat {
  norad: number;
  name: string;
  slug: string;
  line1: string;
  line2: string;
  color: string;
  purpose?: string | null;
  constellation?: string | null;
}

function band(a: number) {
  return a < 2000 ? "LEO" : a < 30000 ? "MEO" : a < 40000 ? "GEO" : "HEO";
}

const BAND_TONE: Record<string, string> = {
  LEO: "text-cyan-300",
  MEO: "text-amber-300",
  GEO: "text-pink-300",
  HEO: "text-violet-300",
};

function azi(deg: number) {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function PassRow({ p }: { p: PassInfo }) {
  const mins = Math.round(p.duration / 60);
  return (
    <div className="flex items-center justify-between border-b border-line/60 py-1.5 last:border-0">
      <div className="font-mono text-[10px] text-ink-2">
        {p.aos.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
      </div>
      <div className="flex items-center gap-3 font-mono text-[10px]">
        <span className="text-ink-4">{azi(p.azimuthAtAos)}→{azi(p.azimuthAtLos)}</span>
        <span className="text-ink-4">{mins}m</span>
        <span className={p.maxElevation > 45 ? "text-success" : p.maxElevation > 20 ? "text-warning" : "text-ink-3"}>
          {Math.round(p.maxElevation)}°
        </span>
      </div>
    </div>
  );
}

export default function TelemetryPanel({
  tracked,
  telemetry,
  userCoords,
  offsetMin,
  onClose,
}: {
  tracked: TrackedSat;
  telemetry: GeoPos | null;
  userCoords: { lat: number; lng: number } | null;
  offsetMin: number;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"live" | "orbit" | "passes">("live");
  const [frequency, setFrequency] = useState(437);
  const [passes, setPasses] = useState<PassInfo[] | null>(null);
  const [computing, setComputing] = useState(false);

  const now = useMemo(() => new Date(Date.now() + offsetMin * 60000), [offsetMin, telemetry]);

  const elements = useMemo(
    () => getOrbitalElements(tracked.line1, tracked.line2),
    [tracked.line1, tracked.line2],
  );
  const elementRows = useMemo(() => (elements ? formatOrbitalElements(elements) : null), [elements]);

  const eclipse = useMemo(
    () => isInEclipse(tracked.line1, tracked.line2, now),
    [tracked.line1, tracked.line2, now],
  );

  const doppler = useMemo(() => {
    if (!userCoords) return null;
    return calculateDopplerShift(
      tracked.line1,
      tracked.line2,
      now,
      userCoords.lat,
      userCoords.lng,
      frequency * 1e6,
    );
  }, [tracked.line1, tracked.line2, now, userCoords, frequency]);

  const look = useMemo(() => {
    if (!userCoords || !telemetry) return null;
    return {
      az: getBearing(userCoords.lat, userCoords.lng, telemetry.lat, telemetry.lng),
      el: getElevation(userCoords.lat, userCoords.lng, telemetry.lat, telemetry.lng, telemetry.altKm),
    };
  }, [userCoords, telemetry]);

  const computePasses = () => {
    if (!userCoords) return;
    setComputing(true);
    // Defer so the spinner paints before the (expensive) propagation loop.
    setTimeout(() => {
      setPasses(getFuturePasses(tracked.line1, tracked.line2, userCoords.lat, userCoords.lng, 48, 5));
      setComputing(false);
    }, 30);
  };

  const tiles: [string, string][] = telemetry
    ? [
        ["Latitude", `${Math.abs(telemetry.lat).toFixed(2)}° ${telemetry.lat >= 0 ? "N" : "S"}`],
        ["Longitude", `${Math.abs(telemetry.lng).toFixed(2)}° ${telemetry.lng >= 0 ? "E" : "W"}`],
        ["Altitude", `${telemetry.altKm.toFixed(1)} km`],
        ["Velocity", `${telemetry.speedKmS.toFixed(2)} km/s`],
      ]
    : [];

  return (
    <div className="absolute bottom-16 left-3 z-20 flex w-[min(340px,calc(100%-1.5rem))] flex-col border bg-black/85 shadow-2xl backdrop-blur-md"
      style={{ borderColor: `${tracked.color}66` }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line bg-white/[0.02] px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tracked.color }} />
          <span className="truncate font-mono text-[11px] uppercase tracking-[0.18em] text-ink-2">{tracked.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-ink-4">#{tracked.norad}</span>
          <button onClick={onClose} className="p-1 text-ink-3 transition-colors hover:text-ink" aria-label="Close telemetry panel">✕</button>
        </div>
      </div>

      {/* Status strip */}
      <div className="flex items-center justify-between border-b border-line px-4 py-2 font-mono text-[9px] uppercase tracking-[0.2em]">
        <span className={BAND_TONE[band(telemetry?.altKm ?? 0)] ?? "text-ink-3"}>
          {telemetry ? band(telemetry.altKm) : "—"}
        </span>
        <span className={eclipse ? "text-danger" : "text-success"}>
          {eclipse ? "◐ In eclipse" : "☀ Sunlit"}
        </span>
        {look && <span className="text-ink-3">EL {look.el.toFixed(0)}°</span>}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-line" role="tablist">
        {(["live", "orbit", "passes"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 border-r border-line py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors last:border-r-0 ${
              tab === t ? "bg-white/[0.04] text-accent" : "text-ink-3 hover:text-ink-2"
            }`}
          >
            {t === "live" ? "Live" : t === "orbit" ? "Elements" : "Passes"}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="max-h-[46vh] min-h-[180px] overflow-y-auto p-4">
        {tab === "live" && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 font-mono text-[11px]">
              {tiles.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[9px] uppercase tracking-[0.18em] text-ink-4">{k}</dt>
                  <dd className="mt-0.5 tabular-nums text-ink">{v}</dd>
                </div>
              ))}
              {!telemetry && <div className="col-span-2 text-ink-4">Propagating…</div>}
            </dl>

            {look && (
              <div className="flex items-center justify-between border border-line bg-white/[0.015] px-3 py-2 font-mono text-[10px]">
                <span className="text-ink-4 uppercase tracking-[0.18em]">Look angle</span>
                <span className="text-ink-2">
                  AZ {look.az.toFixed(0)}° {azi(look.az)} · EL {look.el.toFixed(0)}°{" "}
                  <span className={look.el > 0 ? "text-success" : "text-ink-4"}>
                    {look.el > 0 ? "● visible" : "below horizon"}
                  </span>
                </span>
              </div>
            )}

            {/* Doppler */}
            {userCoords && (
              <div className="border border-line bg-white/[0.015] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-4">Doppler shift</span>
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    <input
                      type="number"
                      value={frequency}
                      onChange={(e) => setFrequency(Math.max(1, Number(e.target.value)))}
                      className="w-14 border border-line bg-black/40 px-1 py-0.5 text-right text-ink-2 outline-none focus:border-accent"
                    />
                    <span className="text-ink-4">MHz</span>
                  </div>
                </div>
                {doppler ? (
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className={doppler.approaching ? "text-success" : "text-danger"}>
                      {doppler.approaching ? "▼ approaching" : "▲ receding"}
                    </span>
                    <span className="tabular-nums text-ink">
                      {doppler.shiftKHz >= 0 ? "+" : ""}{doppler.shiftKHz.toFixed(2)} kHz
                    </span>
                  </div>
                ) : (
                  <div className="font-mono text-[10px] text-ink-4">Share your location to compute shift</div>
                )}
              </div>
            )}
            {!userCoords && (
              <p className="font-mono text-[9px] leading-relaxed text-ink-4">
                Share your location in the sidebar for look angles, Doppler shift and pass predictions.
              </p>
            )}
          </div>
        )}

        {tab === "orbit" && elementRows && (
          <div className="space-y-4">
            <dl className="spec-list">
              {Object.entries(elementRows).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2 font-mono text-[9px] uppercase tracking-[0.15em]">
              {elements && elements.eccentricity < 0.01 && <span className="border border-line px-2 py-0.5 text-ink-3">near-circular</span>}
              {elements && elements.inclination > 80 && <span className="border border-line px-2 py-0.5 text-ink-3">polar</span>}
              {elements && elements.inclination < 10 && <span className="border border-line px-2 py-0.5 text-ink-3">equatorial</span>}
              {elements && elements.eccentricity > 0.25 && <span className="border border-danger/40 px-2 py-0.5 text-danger">highly elliptical</span>}
            </div>
          </div>
        )}

        {tab === "passes" && (
          <div className="space-y-3">
            {!userCoords ? (
              <p className="font-mono text-[10px] leading-relaxed text-ink-4">
                Share your location to predict overhead passes for the next 48 hours.
              </p>
            ) : passes === null ? (
              <button
                onClick={computePasses}
                disabled={computing}
                className="w-full border border-accent/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-accent transition-colors hover:bg-accent/10"
              >
                {computing ? "Computing…" : "Compute next 48h passes"}
              </button>
            ) : passes.length === 0 ? (
              <p className="font-mono text-[10px] text-ink-4">No passes above 5° in the next 48 hours.</p>
            ) : (
              <>
                <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-ink-4">
                  <span>AOS time</span>
                  <span>AZ · dur · max el</span>
                </div>
                {passes.slice(0, 12).map((p, i) => (
                  <PassRow key={i} p={p} />
                ))}
                <button onClick={computePasses} className="font-mono text-[9px] uppercase tracking-[0.2em] text-accent/70 hover:text-accent">
                  ↻ refresh
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-line px-4 py-2.5 text-center">
        <Link
          href={`/satellites/${tracked.slug}`}
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent transition-colors hover:text-ink"
        >
          Full satellite profile →
        </Link>
      </div>
    </div>
  );
}
