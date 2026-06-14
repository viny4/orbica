"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eyebrow } from "@/components/ui";

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
  return { text: `${d > 0 ? `${d}d ` : ""}${pad(h)}:${pad(m)}:${pad(s)}`, soon: diff < 3600000 };
}

function Countdown({ target }: { target: string }) {
  const { text, soon } = useCountdown(target);
  return (
    <span className={`font-mono tabular-nums text-lg ${soon ? "text-[var(--color-space-accent-2)]" : "text-white/80"}`}>
      T- {text}
    </span>
  );
}

export default function UpcomingPage() {
  const [items, setItems] = useState<Upcoming[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/launches/upcoming?limit=40")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Upcoming[]) => setItems(d))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Eyebrow>Next on the pad</Eyebrow>
      <h1 className="mt-4 mb-8 font-light uppercase leading-[0.95] tracking-tight text-5xl sm:text-6xl">
        Upcoming Launches
      </h1>

      {loading ? (
        <div className="border-t border-white/10">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-5 border-b border-white/10 animate-pulse">
              <div className="space-y-2 flex-1">
                <div className="h-5 w-1/2 bg-white/[0.06] rounded" />
                <div className="h-3 w-1/3 bg-white/[0.04] rounded" />
              </div>
              <div className="h-5 w-32 bg-white/[0.06] rounded" />
            </div>
          ))}
        </div>
      ) : (
        <ul className="border-t border-white/10">
          {items.map((l) => (
            <li key={l.id}>
              <Link
                href={`/launches/${l.id}`}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-5 border-b border-white/10 px-2 -mx-2 hover:bg-white/[0.03] transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-light text-lg truncate group-hover:text-[var(--color-space-accent-2)] transition-colors">
                    {l.mission_name || l.name}
                  </div>
                  <div className="text-[13px] text-white/45 truncate mt-0.5">
                    {l.rocket_name || "Unknown rocket"}
                    {l.agency_name ? ` · ${l.agency_name}` : ""}
                    {l.site_name ? ` · ${l.site_name}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right">
                    <Countdown target={l.launch_time} />
                    <div className="text-[10px] tracking-[0.2em] uppercase text-white/35 mt-0.5">
                      {new Date(l.launch_time).toLocaleString("en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        timeZone: "UTC", timeZoneName: "short",
                      })}
                    </div>
                  </div>
                  <span className="text-white/20 group-hover:text-white/50 transition-colors">→</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
