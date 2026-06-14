"use client";

import { useState } from "react";

// Each agency's own logo on a clean tile (press-kit style). Falls back to a
// monogram when there's no logo or it fails to load.

function initials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function AgencyLogo({
  src,
  name,
  className = "w-12 h-12",
}: {
  src?: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${className} grid place-items-center bg-white/[0.04] border border-white/10 rounded-md text-white/50 font-light tracking-wide flex-shrink-0`}
      >
        {initials(name)}
      </div>
    );
  }

  return (
    <div className={`${className} grid place-items-center bg-white rounded-md p-1.5 flex-shrink-0 overflow-hidden`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={name}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="max-w-full max-h-full object-contain"
      />
    </div>
  );
}
