import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lost in space — Orbica",
  robots: { index: false },
};

// Real 404 (HTTP status 404, not a 200 "not found" page), for unknown routes
// and for detail pages whose entity doesn't exist.
export default function NotFound() {
  return (
    <div className="shell flex min-h-[78vh] flex-col items-center justify-center pt-24 text-center">
      <div className="relative mb-10 h-40 w-40" aria-hidden>
        <div className="absolute inset-8 rounded-full bg-[radial-gradient(circle_at_35%_30%,#1d3a6e,#070b16_70%)] shadow-[0_0_60px_rgba(91,140,255,0.25)]" />
        <div className="absolute inset-0 rounded-full border border-line-strong [transform:rotateX(70deg)]" />
        <div className="absolute inset-0 motion-safe:animate-[orbit-spin_9s_linear_infinite]">
          <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_12px_#7df9ff]" />
        </div>
      </div>
      <p className="eyebrow">Error 404 · signal lost</p>
      <h1 className="mt-4 text-title font-light uppercase tracking-tight">Nothing in this orbit</h1>
      <p className="mt-5 max-w-md text-sm leading-relaxed text-ink-3">
        The page you were tracking doesn&apos;t exist — it may have been renamed, or the object
        was never catalogued.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-primary">Back to Orbica</Link>
        <Link href="/search" className="btn btn-secondary">Search the catalogue</Link>
      </div>
    </div>
  );
}
