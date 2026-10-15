"use client";

import { useEffect, useRef, useState } from "react";

// Time-machine transport for the live tracker. Scrub the orbit forward or
// backward from "now", or press play to animate the constellation at 1×–600×
// real time. The offset is in minutes, matching the tracker's shared clock.
export default function TimeMachine({
  offsetMin,
  setOffsetMin,
  shownTime,
  orbitPeriodMin,
}: {
  offsetMin: number;
  setOffsetMin: (v: number) => void;
  shownTime: Date;
  orbitPeriodMin?: number | null;
}) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(60); // simulated minutes per real second
  const rafRef = useRef<number | null>(null);
  const offsetRef = useRef(offsetMin);
  offsetRef.current = offsetMin;

  // Animate the offset while playing. Reading the latest offset from a ref keeps
  // this effect stable — otherwise each setState would restart the loop and the
  // clock would never advance.
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      const next = Math.max(-360, Math.min(360, offsetRef.current + dt * speed));
      setOffsetMin(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, setOffsetMin]);

  const isLive = offsetMin === 0 && !playing;

  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 border border-line-strong bg-black/70 px-3 py-2 backdrop-blur-md sm:gap-3">
      {/* Play / pause */}
      <button
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? "Pause time" : "Play time"}
        className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] transition-colors ${
          playing ? "border-accent bg-accent/20 text-accent" : "border-line-strong text-ink-2 hover:border-accent hover:text-accent"
        }`}
      >
        {playing ? "❚❚" : "▶"}
      </button>

      {/* Live */}
      <button
        onClick={() => { setPlaying(false); setOffsetMin(0); }}
        className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
          isLive ? "border border-emerald-400/60 text-success" : "border border-line-strong text-ink-2 hover:text-white"
        }`}
      >
        {isLive ? "● Live" : "Live"}
      </button>

      {/* Orbit jumps */}
      {orbitPeriodMin && (
        <div className="hidden items-center gap-1 sm:flex">
          <button
            onClick={() => setOffsetMin(Math.max(-360, offsetMin - orbitPeriodMin))}
            className="border border-line-strong px-1.5 py-1 font-mono text-[10px] text-ink-2 transition-colors hover:border-accent hover:text-accent"
            title="Back one orbit"
          >
            ⏮ orbit
          </button>
          <button
            onClick={() => setOffsetMin(Math.min(360, offsetMin + orbitPeriodMin))}
            className="border border-line-strong px-1.5 py-1 font-mono text-[10px] text-ink-2 transition-colors hover:border-accent hover:text-accent"
            title="Forward one orbit"
          >
            orbit ⏭
          </button>
        </div>
      )}

      {/* Scrubber */}
      <input
        type="range"
        min={-360}
        max={360}
        step={1}
        value={Math.round(offsetMin)}
        onChange={(e) => { setPlaying(false); setOffsetMin(Number(e.target.value)); }}
        className="w-28 accent-accent cursor-pointer sm:w-52"
        aria-label="Time machine"
      />

      {/* Clock */}
      <span className="hidden w-40 text-center font-mono text-[11px] tabular-nums text-ink-2 md:block">
        {shownTime.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" })}
      </span>

      {/* Speed */}
      <select
        value={speed}
        onChange={(e) => setSpeed(Number(e.target.value))}
        className="cursor-pointer border border-line-strong bg-black/40 px-1.5 py-1 font-mono text-[10px] text-ink-2 outline-none focus:border-accent"
        aria-label="Playback speed"
      >
        {[1, 10, 60, 300, 600].map((s) => (
          <option key={s} value={s} className="bg-surface">
            {s}×
          </option>
        ))}
      </select>
    </div>
  );
}
