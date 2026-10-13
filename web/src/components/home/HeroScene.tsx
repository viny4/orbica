"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { WebGLGuard } from "@/components/three/WebGLGuard";
import { useInView } from "@/components/three/useInView";

const Hero3D = dynamic(() => import("./Hero3D"), { ssr: false });

// The hero backdrop, in two layers that occupy the same pixels:
//  1. A CSS planet "poster" (gradients + rings, positioned by the --p-* vars
//     set in .hero-planet) — paints instantly, costs no JS, and stays as the
//     fallback when WebGL is missing or the visitor has Save-Data on.
//  2. The WebGL Earth, mounted only once the page has loaded and gone idle, so
//     its ~220 kB of three.js never competes with first paint or hydration.
//     It fades in over the poster when its first textured frame is drawn.
export default function HeroScene() {
  const { ref, inView } = useInView<HTMLDivElement>("0px");
  const [mount, setMount] = useState(false);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);

    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return () => mq.removeEventListener?.("change", onChange);

    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const go = () => setMount(true);
    const schedule = () => {
      if ("requestIdleCallback" in window) idle = window.requestIdleCallback(go, { timeout: 2000 });
      else timer = setTimeout(go, 400);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    return () => {
      mq.removeEventListener?.("change", onChange);
      window.removeEventListener("load", schedule);
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <div ref={ref} className="hero-stage pointer-events-none absolute inset-0" aria-hidden>
      {/* Layer 1: CSS poster planet + rings */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${ready ? "opacity-0" : "opacity-100"}`}>
        <div className="hero-planet">
          <div className="hero-planet-body" />
          <div className="hero-ring hero-ring-1" />
          <div className="hero-ring hero-ring-2" />
        </div>
      </div>

      {/* Layer 2: WebGL Earth */}
      {mount && (
        <div className={`absolute inset-0 transition-opacity duration-1000 ${ready ? "opacity-100" : "opacity-0"}`}>
          <WebGLGuard fallback={null}>
            <Hero3D inView={inView} reducedMotion={reduced} onReady={() => setReady(true)} />
          </WebGLGuard>
        </div>
      )}
    </div>
  );
}
