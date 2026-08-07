"use client";

import { useEffect, useState } from "react";

// An <img> that swaps to a fallback when the source fails to load (404, CDN
// hiccup, etc.) — so broken images never render a broken-icon.
//
// These point at a third-party CDN we don't control. Images inside the viewport
// load eagerly even with loading="lazy", and an eager <img> holds the window
// `load` event open: when that CDN stalls, the page looks hung for 30s+ even
// though our own content is already painted. fetchPriority="low" keeps them off
// the critical path, and mounting the src only after first paint means a slow
// third party can never block the page's load event.
export function SafeImg({
  src,
  alt,
  className,
  fallback = null,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  // Attach the src after mount so the request starts post-paint and can't hold
  // the window `load` event open behind a slow third-party CDN.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  if (failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={ready ? src : undefined}
      alt={alt}
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
