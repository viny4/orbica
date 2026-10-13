"use client";

import { useSyncExternalStore } from "react";

// One shared clock for every countdown on the page. Forty launch cards used to
// run forty setIntervals (and forty re-render schedules); now a single 1s timer
// runs only while something is subscribed, and every subscriber reads the same
// instant so countdowns tick in lockstep.

const listeners = new Set<() => void>();
let now = 0;
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const getSnapshot = () => now || Date.now();
// Server render + hydration use 0 so markup matches; the first client tick
// replaces it (callers render a placeholder for 0).
const getServerSnapshot = () => 0;

/** Current epoch ms, updated once per second; 0 during SSR/hydration. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Break a duration into countdown parts. */
export function countdown(targetMs: number, nowMs: number) {
  const diff = Math.max(0, targetMs - nowMs);
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    diff,
    days: d,
    hours: pad(h),
    mins: pad(m),
    secs: pad(s),
    text: `${d > 0 ? `${d}d ` : ""}${pad(h)}:${pad(m)}:${pad(s)}`,
    soon: diff < 3_600_000,
  };
}
