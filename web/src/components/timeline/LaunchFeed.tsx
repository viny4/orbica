"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getLaunchTitle } from "@/lib/api";
import { apiJSON, isAbort } from "@/lib/clientApi";
import { Outcome } from "@/components/ui";

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

function SkeletonRow() {
  return (
    <li className="relative animate-pulse py-4" aria-hidden>
      <div className="absolute -left-20 top-1 w-16 text-right sm:-left-28">
        <div className="ml-auto h-3 w-10 rounded bg-white/10" />
      </div>
      <div className="absolute -left-[4px] top-[22px] h-[9px] w-[9px] rounded-full border border-white/10" />
      <div className="space-y-3 pl-6 sm:pl-8">
        <div className="h-4 w-24 rounded-full bg-white/10" />
        <div className="h-6 w-3/4 rounded bg-white/10" />
        <div className="h-4 w-1/2 rounded bg-white/5" />
      </div>
    </li>
  );
}

// Infinite-scroll launch list: loads a page at a time as the user scrolls,
// showing skeleton placeholders while the next batch streams in. Goes through
// apiFetch (Supabase first) — the old relative /api fetch rode the slow Next
// proxy to a possibly-cold dyno. A failed page shows a retry, never a false
// "no launches".
export default function LaunchFeed({ year }: { year: number }) {
  const [items, setItems] = useState<LaunchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const offsetRef = useRef(0);
  const inflight = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadMore = useCallback(async () => {
    if (inflight.current || done || failed) return;
    inflight.current = true;
    setLoading(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const data = await apiJSON<LaunchRow[]>(`/api/v1/timeline/years/${year}?limit=${PAGE}&offset=${offsetRef.current}`, {
        signal: ctrl.signal,
      });
      setItems((prev) => [...prev, ...data]);
      offsetRef.current += data.length;
      if (data.length < PAGE) setDone(true);
    } catch (e) {
      if (!isAbort(e)) setFailed(true);
    } finally {
      setLoading(false);
      inflight.current = false;
    }
  }, [year, done, failed]);

  useEffect(() => {
    loadMore();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && loadMore(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  // Clearing `failed` re-mounts the sentinel; its observer fires immediately
  // while it's in view, which loads the page that failed.
  const retry = () => setFailed(false);

  return (
    <div className="relative max-w-4xl pb-24 pl-20 pt-6 sm:pl-28">
      {/* The vertical timeline line */}
      <div aria-hidden className="absolute bottom-0 left-20 top-6 w-px bg-gradient-to-b from-line-strong via-line to-transparent sm:left-28" />

      <ul className="space-y-14">
        {items.map((l, i) => {
          const launchDate = l.launch_time
            ? new Date(l.launch_time).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
            : "TBD";
          return (
            <li key={l.id} className="rp-fade-in group relative" style={{ animationDelay: `${(i % PAGE) * 18}ms` }}>
              {/* Gutter date */}
              <div className="absolute -left-20 top-[18px] w-16 text-right sm:-left-28">
                <span className="font-mono text-[11px] uppercase tracking-widest text-accent/80">{launchDate}</span>
              </div>

              {/* Timeline node */}
              <div aria-hidden className="absolute -left-[4.5px] top-[22px] z-10 h-[10px] w-[10px] rounded-full border border-ink-3 bg-void transition-colors group-hover:border-accent group-hover:bg-accent/30" />

              <Link href={`/launches/${l.id}`} className="block pl-6 sm:pl-10">
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-line-strong px-2 py-0.5">
                      <Outcome outcome={l.outcome} />
                    </span>
                    {l.agency_name && <span className="text-xs text-ink-3">{l.agency_name}</span>}
                  </div>
                  <h3 className="font-serif text-2xl font-normal leading-tight text-ink transition-colors group-hover:text-accent md:text-3xl">
                    {getLaunchTitle(l.mission_name, l.name, l.rocket_name)}
                  </h3>
                  <p className="max-w-2xl text-sm font-light text-ink-2">Launched aboard {l.rocket_name || "an unknown rocket"}.</p>
                  <div className="mt-1 flex items-center font-mono text-[11px] uppercase tracking-widest text-ink-4 transition-colors group-hover:text-ink-2">
                    Mission details <span className="ml-2" aria-hidden>→</span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}

        {loading && Array.from({ length: items.length ? 3 : 6 }).map((_, i) => <SkeletonRow key={`sk-${i}`} />)}

        {!done && !failed && <div ref={sentinel} aria-hidden className="h-1" />}

        {failed && (
          <li className="pl-6 sm:pl-10">
            <div className="card p-6">
              <p className="text-sm text-ink-2">Couldn&apos;t load {items.length ? "more launches" : `the launches for ${year}`} — the data link timed out.</p>
              <button onClick={retry} className="btn btn-secondary mt-4">
                Retry
              </button>
            </div>
          </li>
        )}

        {done && items.length > 0 && (
          <li className="relative py-4 pl-6 font-mono text-[10px] uppercase tracking-[0.3em] text-ink-4 sm:pl-10">
            <div aria-hidden className="absolute -left-[3.5px] top-6 z-10 h-[8px] w-[8px] rounded-full bg-white/10" />
            End of {year}
          </li>
        )}
        {done && items.length === 0 && <li className="py-16 text-sm text-ink-3">No launches recorded for {year}.</li>}
      </ul>
    </div>
  );
}
