"use client";

import Link from "next/link";
import { useEffect } from "react";

// Shown when a page can't load its data (every upstream failed or timed out),
// instead of rendering a misleading empty or "not found" page. Retry re-runs
// the server render; the data sources usually recover within seconds.
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surfaces in browser devtools / RUM; the digest links to the server log.
    console.error("[orbica] route error", error.digest ?? "", error.message);
  }, [error]);

  return (
    <div className="shell flex min-h-[70vh] flex-col items-start justify-center pt-24">
      <p className="eyebrow text-warning/80">Telemetry interrupted</p>
      <h1 className="mt-4 max-w-3xl text-title font-light uppercase tracking-tight">We couldn&apos;t reach the data link</h1>
      <p className="mt-5 max-w-xl text-sm leading-relaxed text-ink-3">
        Our data sources didn&apos;t answer in time. Nothing is wrong with the page you asked for —
        retrying usually works within a few seconds.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <button onClick={reset} className="btn btn-primary">Retry</button>
        <Link href="/" className="btn btn-secondary">Home</Link>
      </div>
      {error.digest && <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-4">Ref {error.digest}</p>}
    </div>
  );
}
