"use client";
export const runtime = "edge";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eyebrow } from "@/components/ui";
import { getLaunchTitle } from "@/lib/api";
import { apiFetch } from "@/lib/clientApi";

interface Upcoming {
  id: string;
  name: string;
  mission_name: string | null;
  launch_time: string;
  rocket_slug: string | null;
  rocket_name: string | null;
  agency_slug: string | null;
  agency_name: string | null;
  site_name: string | null;
  mission_type: string | null;
  mission_description?: string | null;
}

function useCountdown(target: string) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, new Date(target).getTime() - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    text: `${d > 0 ? `${d}d ` : ""}${pad(h)}:${pad(m)}:${pad(s)}`,
    soon: diff < 3600000,
    days: d,
    hours: pad(h),
    mins: pad(m),
    secs: pad(s),
  };
}

function HeroCountdown({ target }: { target: string }) {
  const { days, hours, mins, secs, soon } = useCountdown(target);
  return (
    <div className="flex gap-3 sm:gap-6 font-mono text-center">
      {days > 0 && (
        <div className="flex flex-col">
          <span className="text-3xl sm:text-5xl font-light text-white">{days}</span>
          <span className="text-[9px] uppercase tracking-widest text-white/30 mt-1">Days</span>
        </div>
      )}
      <div className="flex flex-col">
        <span className={`text-3xl sm:text-5xl font-light ${soon ? "text-[var(--color-space-accent-2)]" : "text-white"}`}>
          {hours}
        </span>
        <span className="text-[9px] uppercase tracking-widest text-white/30 mt-1">Hours</span>
      </div>
      <span className="text-3xl sm:text-5xl font-light text-white/20">:</span>
      <div className="flex flex-col">
        <span className={`text-3xl sm:text-5xl font-light ${soon ? "text-[var(--color-space-accent-2)]" : "text-white"}`}>
          {mins}
        </span>
        <span className="text-[9px] uppercase tracking-widest text-white/30 mt-1">Mins</span>
      </div>
      <span className="text-3xl sm:text-5xl font-light text-white/20">:</span>
      <div className="flex flex-col">
        <span className={`text-3xl sm:text-5xl font-light ${soon ? "text-[var(--color-space-accent-2)]" : "text-white"}`}>
          {secs}
        </span>
        <span className="text-[9px] uppercase tracking-widest text-white/30 mt-1">Secs</span>
      </div>
    </div>
  );
}

function SmallCountdown({ target }: { target: string }) {
  const { text, soon } = useCountdown(target);
  return (
    <span className={`font-mono text-sm tabular-nums tracking-wider ${soon ? "text-[var(--color-space-accent-2)]" : "text-white/80"}`}>
      T- {text}
    </span>
  );
}

export default function UpcomingPage() {
  const [items, setItems] = useState<Upcoming[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/v1/launches/upcoming?limit=40")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Upcoming[]) => setItems(d))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const nextLaunch = items[0];
  const remainingLaunches = items.slice(1);

  return (
    <div className="space-y-10">
      <div>
        <Eyebrow>Orbital Schedule & Launch Manifest</Eyebrow>
        <h1 className="mt-4 mb-3 font-light uppercase leading-[0.95] tracking-tight text-5xl sm:text-6xl">
          Upcoming Missions
        </h1>
        <p className="max-w-xl text-xs sm:text-sm text-white/50 font-light">
          Real-time countdowns and mission telemetry for scheduled orbital flights worldwide.
        </p>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="h-64 border border-white/10 bg-white/[0.01] animate-pulse rounded" />
          <div className="border-t border-white/10">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-5 border-b border-white/10 animate-pulse">
                <div className="space-y-2 flex-1">
                  <div className="h-5 w-1/2 bg-white/[0.06] rounded" />
                  <div className="h-3 w-1/3 bg-white/[0.04] rounded" />
                </div>
                <div className="h-5 w-32 bg-white/[0.06] rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* ── Spotlight Countdown Hero ── */}
          {nextLaunch && (
            <div className="border border-[var(--color-space-accent-2)]/30 bg-gradient-to-br from-white/[0.02] via-transparent to-[var(--color-space-accent-2)]/[0.01] p-6 sm:p-8 flex flex-col md:flex-row gap-8 items-center justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[radial-gradient(circle_at_top_right,var(--color-space-accent-2),transparent_60%)] opacity-30 pointer-events-none" />
              
              <div className="space-y-4 max-w-xl self-start md:self-auto">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-space-accent-2)] animate-ping" />
                  <span className="text-[10px] font-mono tracking-widest text-[var(--color-space-accent-2)] uppercase">
                    Immediate Target &middot; Next Launch
                  </span>
                </div>
                <Link
                  href={`/launches/${nextLaunch.id}`}
                  className="block text-2xl sm:text-3xl font-light uppercase text-white hover:text-[var(--color-space-accent-2)] transition-colors"
                >
                  {getLaunchTitle(nextLaunch.mission_name, nextLaunch.name, nextLaunch.rocket_name)}
                </Link>
                <p className="text-xs text-white/50 font-light leading-relaxed">
                  {nextLaunch.mission_description || "Mission details are classified or pending final confirmation from the orbital operator."}
                </p>
                
                <div className="grid grid-cols-2 gap-4 pt-2 text-[11px] font-mono text-white/40">
                  <div>
                    <span className="uppercase text-[9px] block text-white/20">Vehicle</span>
                    <span className="text-white">{nextLaunch.rocket_name || "—"}</span>
                  </div>
                  <div>
                    <span className="uppercase text-[9px] block text-white/20">Operator</span>
                    <span className="text-white">{nextLaunch.agency_name || "—"}</span>
                  </div>
                  <div>
                    <span className="uppercase text-[9px] block text-white/20">Launch Site</span>
                    <span className="text-white">{nextLaunch.site_name || "—"}</span>
                  </div>
                  <div>
                    <span className="uppercase text-[9px] block text-white/20">UTC Target</span>
                    <span className="text-white">
                      {new Date(nextLaunch.launch_time).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center md:items-end gap-3 shrink-0 self-center md:self-auto border-t md:border-t-0 md:border-l border-white/10 pt-6 md:pt-0 md:pl-8 w-full md:w-auto">
                <HeroCountdown target={nextLaunch.launch_time} />
                <Link
                  href={`/launches/${nextLaunch.id}`}
                  className="mt-4 px-6 py-2.5 bg-white text-black font-semibold text-[10px] tracking-widest uppercase hover:bg-white/90 transition-all text-center w-full md:w-auto"
                >
                  Telemetry Details →
                </Link>
              </div>
            </div>
          )}

          {/* ── Schedule Grid ── */}
          <div className="space-y-4">
            <h2 className="text-[10px] tracking-[0.25em] uppercase text-white/40 font-mono border-b border-white/10 pb-3">
              Upcoming Manifest ({remainingLaunches.length})
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {remainingLaunches.map((l) => (
                <div
                  key={l.id}
                  className="border border-white/10 bg-white/[0.015] p-5 flex flex-col justify-between hover:border-[var(--color-space-accent-2)]/30 hover:bg-white/[0.025] transition-all group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[9px] font-mono tracking-wider uppercase border border-white/10 px-2 py-0.5 text-white/40">
                        {l.mission_type || "Spaceflight"}
                      </span>
                      <SmallCountdown target={l.launch_time} />
                    </div>

                    <Link
                      href={`/launches/${l.id}`}
                      className="block text-base uppercase font-light text-white group-hover:text-[var(--color-space-accent-2)] transition-colors truncate"
                    >
                      {getLaunchTitle(l.mission_name, l.name, l.rocket_name)}
                    </Link>

                    <div className="text-[11px] font-mono text-white/45 space-y-0.5">
                      <div>Vehicle: <span className="text-white/75">{l.rocket_name || "—"}</span></div>
                      <div>Agency: <span className="text-white/75">{l.agency_name || "—"}</span></div>
                      <div className="truncate">Pad: <span className="text-white/75">{l.site_name || "—"}</span></div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-white/30">
                      {new Date(l.launch_time).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}
                    </span>
                    <Link
                      href={`/launches/${l.id}`}
                      className="text-[var(--color-space-accent-2)]/80 hover:text-[var(--color-space-accent-2)] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                    >
                      Details →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
