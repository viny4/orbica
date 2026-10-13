"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

/**
 * Drives a `frameloop="demand"` Canvas at a capped frame rate while `active`,
 * and stops entirely when the tab is hidden.
 *
 * Don't use it with drei's <OrbitControls autoRotate>: the controls emit a
 * change event on every auto-rotate step and re-invalidate each frame, so a
 * demand loop never stops (not even off-screen). Those viewers use
 * frameloop={inView ? "always" : "never"} instead.
 *
 * Used by the landing hero: a slowly turning planet gains nothing visible from
 * 60–120fps, but pays 2–4x the GPU time and battery for it.
 */
export function FpsTicker({ active, fps = 30 }: { active: boolean; fps?: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate(); // always draw at least the current frame
    if (!active) return;
    let id: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      if (!id && !document.hidden) id = setInterval(() => invalidate(), 1000 / fps);
    };
    const stop = () => {
      if (id) clearInterval(id);
      id = undefined;
    };
    const onVis = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [active, fps, invalidate]);
  return null;
}
