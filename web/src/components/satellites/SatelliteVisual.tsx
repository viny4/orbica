"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { WebGLGuard, WebGLFallback } from "@/components/three/WebGLGuard";

const Placeholder = ({ label }: { label: string }) => (
  <div className="grid aspect-square w-full place-items-center border border-line bg-black">
    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-4">{label}</span>
  </div>
);

// Each view is its own chunk, loaded only when shown: the procedural spacecraft
// model is large and most visitors stay on the live orbit.
const OrbitViewer3D = dynamic(() => import("./OrbitViewer3D"), {
  ssr: false,
  loading: () => <Placeholder label="Loading live orbit…" />,
});
const SatelliteModel3D = dynamic(() => import("./SatelliteModel3D"), {
  ssr: false,
  loading: () => <Placeholder label="Loading 3D model…" />,
});

type Mode = "orbit" | "model" | "photo";

export default function SatelliteVisual({
  name,
  line1,
  line2,
  imageUrl,
  purpose,
  orbitType,
}: {
  name: string;
  line1?: string | null;
  line2?: string | null;
  imageUrl?: string | null;
  purpose?: string | null;
  orbitType?: string | null;
}) {
  const hasTle = Boolean(line1 && line2);
  const [imgOk, setImgOk] = useState(Boolean(imageUrl));
  const tabs: Mode[] = [];
  if (hasTle) tabs.push("orbit");
  tabs.push("model");
  if (imgOk) tabs.push("photo");

  const [mode, setMode] = useState<Mode>(hasTle ? "orbit" : "model");

  const label: Record<Mode, string> = { orbit: "Live Orbit", model: "3D Model", photo: "Photo" };
  const fallback = <WebGLFallback className="aspect-square border border-line" label="3D view needs WebGL" />;

  return (
    <div className="relative">
      {mode === "orbit" && hasTle && (
        <WebGLGuard fallback={fallback}>
          <OrbitViewer3D name={name} line1={line1!} line2={line2!} />
        </WebGLGuard>
      )}
      {mode === "model" && (
        <WebGLGuard fallback={fallback}>
          <SatelliteModel3D spec={{ purpose, orbitType, name }} />
        </WebGLGuard>
      )}
      {mode === "photo" && imageUrl && (
        <div className="relative aspect-square w-full overflow-hidden border border-line bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={name}
            decoding="async"
            onError={() => {
              setImgOk(false);
              setMode("model");
            }}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {tabs.length > 1 && (
        <div className="absolute left-3 top-3 flex" role="group" aria-label="View">
          {tabs.map((t, i) => (
            <button
              key={t}
              onClick={() => setMode(t)}
              aria-pressed={mode === t}
              className={`border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors ${i > 0 ? "border-l-0" : ""} ${
                mode === t ? "border-white bg-white text-black" : "border-white/20 bg-black/40 text-white/70 backdrop-blur hover:text-white"
              }`}
            >
              {label[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
