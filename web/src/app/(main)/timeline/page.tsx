import Link from "next/link";
import { api } from "@/lib/api";
import { EmptyState, safe } from "@/components/EmptyState";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Timeline — Orbica" };

const ERAS = [
  ["Space Race", 1957, 1975],
  ["Shuttle Era", 1976, 1999],
  ["Commercial Dawn", 2000, 2009],
  ["New Space", 2010, 2019],
  ["Megaconstellations", 2020, 2027],
] as const;

export default async function TimelinePage() {
  const years = await safe(api.timelineYears(), []);
  const byYear = new Map(years.map((y) => [y.launch_year, y]));
  const maxCount = Math.max(1, ...years.map((y) => y.total_launches));

  return (
    <div>
      <PageHeader eyebrow="The Archive · 1957 — Present" title="Timeline" />

      {years.length === 0 && (
        <EmptyState message="No launch data yet — run the seed to ingest from Launch Library 2." />
      )}

      <div className="space-y-14">
        {ERAS.map(([name, start, end]) => (
          <section key={name}>
            <div className="flex items-baseline gap-4 mb-5 border-b border-white/10 pb-3">
              <h2 className="text-lg font-light uppercase tracking-[0.2em]">{name}</h2>
              <span className="text-[11px] tracking-[0.2em] uppercase text-white/35 font-mono">
                {start}–{end}
              </span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-10 gap-px bg-white/5">
              {range(start, end).map((yr) => {
                const s = byYear.get(yr);
                const intensity = s ? 0.08 + (s.total_launches / maxCount) * 0.5 : 0;
                return (
                  <Link
                    key={yr}
                    href={`/timeline/${yr}`}
                    className="group relative aspect-square flex flex-col items-center justify-center bg-[#06080f] hover:bg-[#0c1322] transition-colors"
                    style={s ? { backgroundColor: `rgba(91,140,255,${intensity})` } : undefined}
                  >
                    <span className="font-mono text-xs text-white/80 group-hover:text-white">{yr}</span>
                    <span className="text-[10px] text-white/40 font-mono">{s ? s.total_launches : "·"}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function range(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}
