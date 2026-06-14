"use client";

import { useState } from "react";
import OrbitViewer3D from "./OrbitViewer3D";
import SatelliteModel3D from "./SatelliteModel3D";

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

  return (
    <div className="relative">
      {mode === "orbit" && hasTle && (
        <OrbitViewer3D name={name} line1={line1!} line2={line2!} />
      )}
      {mode === "model" && <SatelliteModel3D spec={{ purpose, orbitType }} />}
      {mode === "photo" && imageUrl && (
        <div className="relative w-full aspect-square overflow-hidden border border-white/10 bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={name}
            decoding="async"
            onError={() => {
              setImgOk(false);
              setMode("model");
            }}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {tabs.length > 1 && (
        <div className="absolute top-3 left-3 flex">
          {tabs.map((t, i) => (
            <button
              key={t}
              onClick={() => setMode(t)}
              className={`text-[10px] tracking-[0.18em] uppercase px-3 py-1.5 border transition-colors ${
                i > 0 ? "border-l-0" : ""
              } ${
                mode === t
                  ? "bg-white text-black border-white"
                  : "border-white/20 text-white/60 hover:text-white"
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
