"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { RocketSpec } from "./rocketConfig";
import { WebGLGuard, WebGLFallback } from "@/components/three/WebGLGuard";

const Placeholder = ({ label, aspect = "aspect-square" }: { label: string; aspect?: string }) => (
  <div className={`grid w-full place-items-center border border-line bg-surface ${aspect}`}>
    <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-4">{label}</span>
  </div>
);

// Both 3D views are client-only and loaded on demand: a visitor who only looks
// at the photo never downloads three.js.
const RocketViewer3D = dynamic(() => import("./RocketViewer3D"), {
  ssr: false,
  loading: () => <Placeholder label="Loading 3D model…" />,
});
const LaunchAnimation = dynamic(() => import("./LaunchAnimation"), {
  ssr: false,
  loading: () => <Placeholder label="Preparing launch…" aspect="aspect-[4/3]" />,
});

type Mode = "photo" | "model" | "launch";

// Real photograph first (what the vehicle actually looks like), server-rendered
// so it can paint before any JS runs, with the interactive 3D model and the
// ascent animation a click away.
export default function RocketVisual({
  spec,
  imageUrl,
  credit,
}: {
  spec: RocketSpec;
  imageUrl?: string | null;
  /** Photo attribution, e.g. "SpaceX · CC BY-NC 2.0". */
  credit?: string | null;
}) {
  const [photoOk, setPhotoOk] = useState(Boolean(imageUrl));
  const [mode, setMode] = useState<Mode>(imageUrl ? "photo" : "model");

  const tabs: [Mode, string][] = [
    ...(photoOk ? ([["photo", "Photo"]] as [Mode, string][]) : []),
    ["model", "3D Model"],
    ["launch", "▶ Launch"],
  ];

  return (
    <div className="relative">
      {mode === "photo" && photoOk ? (
        <figure className="relative aspect-square w-full overflow-hidden border border-line bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl as string}
            alt={`${spec.name} launch vehicle`}
            decoding="async"
            fetchPriority="high"
            onError={() => {
              setPhotoOk(false);
              setMode("model");
            }}
            className="h-full w-full object-cover"
          />
          {credit && (
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8 text-right font-mono text-[10px] text-white/60">
              Photo: {credit}
            </figcaption>
          )}
        </figure>
      ) : (
        <WebGLGuard fallback={<WebGLFallback className="aspect-square border border-line" label="3D model needs WebGL" />}>
          {mode === "launch" ? <LaunchAnimation spec={spec} /> : <RocketViewer3D spec={spec} />}
        </WebGLGuard>
      )}

      <div className="absolute left-3 top-3 flex" role="group" aria-label="View">
        {tabs.map(([m, label], i) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`border-y px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors ${
              i === 0 ? "border-l" : ""
            } ${i === tabs.length - 1 ? "border-r" : ""} ${
              mode === m ? "border-white bg-white text-black" : "border-white/20 bg-black/40 text-white/70 backdrop-blur hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
