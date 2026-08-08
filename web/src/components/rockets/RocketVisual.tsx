"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import RocketViewer3D from "./RocketViewer3D";
import type { RocketSpec } from "./rocketConfig";

// The launch animation is heavier than the static viewer and most visitors
// never open it — load it only when its tab is picked.
const LaunchAnimation = dynamic(() => import("./LaunchAnimation"), {
  ssr: false,
  loading: () => (
    <div className="w-full aspect-[4/3] border border-white/10 bg-[#05070f] grid place-items-center text-white/40 text-xs tracking-[0.2em] uppercase">
      Preparing launch…
    </div>
  ),
});

type Mode = "photo" | "model" | "launch";

// Real photograph first (what the vehicle actually looks like), with the
// interactive 3D model and the ascent animation a click away.
export default function RocketVisual({
  spec,
  imageUrl,
}: {
  spec: RocketSpec;
  imageUrl?: string | null;
}) {
  const hasPhoto = Boolean(imageUrl);
  const [mode, setMode] = useState<Mode>(hasPhoto ? "photo" : "model");

  const tabs: [Mode, string][] = [
    ...(hasPhoto ? ([["photo", "Photo"]] as [Mode, string][]) : []),
    ["model", "3D Model"],
    ["launch", "▶ Launch"],
  ];

  return (
    <div className="relative">
      {mode === "photo" && hasPhoto ? (
        <div className="relative w-full aspect-square overflow-hidden border border-white/10 bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl as string}
            alt={spec.name}
            decoding="async"
            onError={() => setMode("model")}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-3 right-3 text-[10px] text-white/50 font-mono bg-black/40 px-2 py-1">
            photograph
          </div>
        </div>
      ) : mode === "launch" ? (
        <LaunchAnimation spec={spec} />
      ) : (
        <RocketViewer3D spec={spec} />
      )}

      <div className="absolute top-3 left-3 flex">
        {tabs.map(([m, label], i) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 border-y transition-colors ${
              i === 0 ? "border-l" : ""
            } ${i === tabs.length - 1 ? "border-r" : ""} ${
              mode === m
                ? "bg-white text-black border-white"
                : "border-white/20 text-white/60 hover:text-white bg-black/30"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
