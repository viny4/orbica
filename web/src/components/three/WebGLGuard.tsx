"use client";

import { Component, useEffect, useState, type ReactNode } from "react";

let cached: boolean | null = null;

/** Probe once per page whether this device can create a WebGL context. */
export function webglAvailable(): boolean {
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as WebGLRenderingContext | null;
    cached = Boolean(gl);
    // Hand the probe context straight back — browsers cap live contexts (~16).
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[orbica] 3D view failed; showing the static fallback", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Wrap any react-three-fiber Canvas. Devices without WebGL (old GPUs, locked-
 * down browsers, some in-app webviews) — or a scene that throws while loading —
 * get `fallback` instead of an exception that would take the whole page down.
 */
export function WebGLGuard({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(cached);
  useEffect(() => {
    if (ok === null) setOk(webglAvailable());
  }, [ok]);

  if (ok === null) return null; // first client render: decide before mounting a Canvas
  if (!ok) return <>{fallback}</>;
  return <Boundary fallback={fallback}>{children}</Boundary>;
}

/** Default fallback: a quiet panel explaining what's missing. */
export function WebGLFallback({ label = "3D view unavailable on this device", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`grid h-full w-full place-items-center bg-[radial-gradient(circle_at_50%_45%,rgba(91,140,255,0.12),transparent_60%)] ${className}`}>
      <p className="px-6 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-ink-4">{label}</p>
    </div>
  );
}
