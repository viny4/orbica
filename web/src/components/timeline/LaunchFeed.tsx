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
    <li className="flex items-center justify-between gap-4 border-b border-white/10 py-4 animate-pulse">
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="h-4 bg-white/10 rounded w-2/3" />
        <div className="h-3 bg-white/[0.06] rounded w-1/3" />
      </div>
      <div className="h-3 w-14 bg-white/10 rounded" />
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
    <ul className="border-t border-white/10">
      {items.map((l, i) => (
        <li key={l.id} className="rp-fade-in" style={{ animationDelay: `${(i % PAGE) * 18}ms` }}>
          <Link
            href={`/launches/${l.id}`}
            className="group flex items-center justify-between gap-4 border-b border-white/10 py-4 px-2 -mx-2 hover:bg-white/[0.03] transition-colors"
          >
            <div className="min-w-0">
              <div className="font-light text-lg truncate group-hover:text-[var(--color-space-accent-2)] transition-colors">
                {getLaunchTitle(l.mission_name, l.name, l.rocket_name)}
              </div>
              <div className="text-[13px] text-white/45 truncate mt-0.5">
                {l.rocket_name || "Unknown rocket"}
                {l.agency_name ? ` · ${l.agency_name}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <span className={`text-[10px] uppercase tracking-[0.2em] font-mono ${outcomeColor(l.outcome)}`}>
                {l.outcome.replace("_", " ")}
              </span>
              <span className="text-white/20 group-hover:text-white/50 transition-colors">→</span>
            </div>
          </Link>
        </li>
      ))}

      {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={`sk-${i}`} />)}

      {!done && <div ref={sentinel} aria-hidden className="h-1" />}

      {done && items.length > 0 && (
        <li className="py-10 text-center text-[10px] tracking-[0.3em] uppercase text-white/25">
          End of {year}
        </li>
      )}
      {done && items.length === 0 && (
        <li className="py-16 text-center text-sm text-white/40">No launches recorded for {year}.</li>
      )}
    </ul>
  );
}
