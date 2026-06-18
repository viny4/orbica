"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getLaunchTitle } from "@/lib/api";

interface LaunchRow {
  id: string;
  name: string;
  mission_name: string | null;
  launch_time: string | null;
  outcome: string;
  rocket_name: string | null;
  agency_name: string | null;
}

const PAGE = 30;

function outcomeColor(o: string) {
  return o === "success"
    ? "text-emerald-400"
    : o === "failure"
      ? "text-red-400"
      : o === "partial_failure"
        ? "text-amber-400"
        : "text-white/40";
}

function SkeletonRow() {
  return (
    <li className="relative py-4 animate-pulse">
      <div className="absolute top-1 -left-20 sm:-left-28 w-16 text-right">
        <div className="h-3 w-10 bg-white/10 rounded ml-auto" />
      </div>
      <div className="absolute top-[22px] -left-[4px] w-[9px] h-[9px] rounded-full border border-white/10 bg-transparent" />
      <div className="pl-6 sm:pl-8 space-y-3">
        <div className="h-4 w-24 bg-white/10 rounded-full" />
        <div className="h-6 w-3/4 bg-white/10 rounded" />
        <div className="h-4 w-1/2 bg-white/5 rounded" />
      </div>
    </li>
  );
}

// Infinite-scroll launch list: loads a page at a time as the user scrolls,
// showing skeleton placeholders while the next batch streams in, then fading
// the real rows in.
export default function LaunchFeed({ year }: { year: number }) {
  const [items, setItems] = useState<LaunchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const offsetRef = useRef(0);
  const inflight = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (inflight.current || done) return;
    inflight.current = true;
    setLoading(true);
    try {
      const r = await fetch(`/api/v1/timeline/years/${year}?limit=${PAGE}&offset=${offsetRef.current}`);
      const data: LaunchRow[] = r.ok ? await r.json() : [];
      setItems((prev) => [...prev, ...data]);
      offsetRef.current += data.length;
      if (data.length < PAGE) setDone(true);
    } catch {
      setDone(true);
    } finally {
      setLoading(false);
      inflight.current = false;
    }
  }, [year, done]);

  useEffect(() => {
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && loadMore(), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  return (
    <div className="relative pl-20 sm:pl-28 max-w-4xl pt-12 pb-24">
      {/* The vertical timeline line */}
      <div className="absolute top-12 bottom-0 left-20 sm:left-28 w-px bg-white/10" />

      <ul className="space-y-16">
        {items.map((l, i) => {
          const launchDate = l.launch_time ? new Date(l.launch_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : "Unknown";
          
          return (
            <li key={l.id} className="relative group rp-fade-in" style={{ animationDelay: `${(i % PAGE) * 18}ms` }}>
              {/* Gutter Date */}
              <div className="absolute top-[18px] -left-20 sm:-left-28 w-16 text-right">
                <span className="text-[11px] font-mono tracking-widest text-[var(--color-space-accent-2)]/80 uppercase">
                  {launchDate}
                </span>
              </div>

              {/* Timeline Node Circle */}
              <div className="absolute top-[22px] -left-[4.5px] w-[10px] h-[10px] rounded-full border border-white/40 bg-[var(--color-space-bg)] group-hover:border-[var(--color-space-accent-2)] transition-colors z-10" />

              {/* Content Card */}
              <Link href={`/launches/${l.id}`} className="block pl-6 sm:pl-10">
                <div className="flex flex-col gap-2.5">
                  {/* Pill Badge */}
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full border border-white/20 text-[9px] font-mono tracking-[0.2em] uppercase ${outcomeColor(l.outcome)}`}>
                      • {l.outcome.replace("_", " ")}
                    </span>
                    {l.agency_name && (
                      <span className="text-xs text-white/50">{l.agency_name}</span>
                    )}
                  </div>

                  {/* Elegant Serif Title */}
                  <h3 className="font-serif text-2xl md:text-3xl font-normal leading-tight text-white group-hover:text-[var(--color-space-accent-2)] transition-colors">
                    {getLaunchTitle(l.mission_name, l.name, l.rocket_name)}
                  </h3>

                  {/* Description / Rocket */}
                  <p className="text-sm text-white/60 font-light max-w-2xl">
                    Launched aboard {l.rocket_name || "Unknown rocket"}.
                  </p>

                  {/* Link Arrow */}
                  <div className="mt-1 flex items-center text-[11px] font-mono tracking-widest uppercase text-white/30 group-hover:text-white/70 transition-colors">
                    View mission details <span className="ml-2">↗</span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}

        {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={`sk-${i}`} />)}

        {!done && <div ref={sentinel} aria-hidden className="h-1" />}

        {done && items.length > 0 && (
          <li className="relative pl-6 sm:pl-10 py-4 text-[10px] tracking-[0.3em] uppercase text-white/25">
            <div className="absolute top-6 -left-[3.5px] w-[8px] h-[8px] rounded-full bg-white/10 z-10" />
            End of {year}
          </li>
        )}
        {done && items.length === 0 && (
          <li className="py-16 text-sm text-white/40">No launches recorded for {year}.</li>
        )}
      </ul>
    </div>
  );
}
