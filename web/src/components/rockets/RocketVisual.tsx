"use client";

import { useState } from "react";
import RocketViewer3D from "./RocketViewer3D";
import type { RocketSpec } from "./rocketConfig";

// Real photograph first (what the vehicle actually looks like), with an
// interactive 3D model a click away. Falls back to 3D when no photo exists.
export default function RocketVisual({
  spec,
  imageUrl,
}: {
  spec: RocketSpec;
  imageUrl?: string | null;
}) {
  const hasPhoto = Boolean(imageUrl);
  const [mode, setMode] = useState<"photo" | "model">(hasPhoto ? "photo" : "model");

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
      ) : (
        <RocketViewer3D spec={spec} />
      )}

      {hasPhoto && (
        <div className="absolute top-3 left-3 flex">
          <button
            onClick={() => setMode("photo")}
            className={`text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 border-y border-l transition-colors ${
              mode === "photo"
                ? "bg-white text-black border-white"
                : "border-white/20 text-white/60 hover:text-white"
            }`}
          >
            Photo
          </button>
          <button
            onClick={() => setMode("model")}
            className={`text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 border transition-colors ${
              mode === "model"
                ? "bg-white text-black border-white"
                : "border-white/20 text-white/60 hover:text-white"
            }`}
          >
            3D Model
          </button>
        </div>
      )}
    </div>
  );
}
