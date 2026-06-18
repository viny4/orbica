import Link from "next/link";
import { api } from "@/lib/api";
import { EmptyState, safe } from "@/components/EmptyState";
import { PageHeader } from "@/components/ui";

export const runtime = "edge";

export const metadata = { title: "Timeline — Orbica" };

interface Era {
  name: string;
  start: number;
  end: number;
  description: string;
  badge: string;
}

const ERAS: Era[] = [
  {
    name: "Space Race",
    start: 1957,
    end: 1975,
    description: "Sputnik to Apollo-Soyuz. Humanity takes its first steps into orbit and the Moon.",
    badge: "Cold War Dawn",
  },
  {
    name: "Shuttle Era",
    start: 1976,
    end: 1999,
    description: "Reusable orbiters, space stations (Salyut, Mir), and deep-space scientific probes.",
    badge: "Low Earth Orbit Ops",
  },
  {
    name: "Commercial Dawn",
    start: 2000,
    end: 2009,
    description: "The ISS becomes permanently inhabited. Initial growth of global commercial launch markets.",
    badge: "ISS & Telecoms",
  },
  {
    name: "New Space",
    start: 2010,
    end: 2019,
    description: "Private aerospace breakthroughs. Rapid growth of cubesats, reusability, and mega-projects.",
    badge: "Reusability & Cubesats",
  },
  {
    name: "Megaconstellations",
    start: 2020,
    end: 2027,
    description: "Thousands of satellites in LEO networks. Commercialization of global satellite broadband.",
    badge: "Starlink & LEO Networks",
  },
];

export default async function TimelinePage() {
  const years = await safe(api.timelineYears(), []);
  const byYear = new Map(years.map((y) => [y.launch_year, y]));
  const maxCount = Math.max(1, ...years.map((y) => y.total_launches));

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Chronological Archive & Flight Records"
        title="Orbital Timeline"
      />

      {years.length === 0 && (
        <EmptyState message="No launch data yet — run the seed to ingest from Launch Library 2." />
      )}

      <div className="space-y-16">
        {ERAS.map((era) => (
          <section key={era.name} className="space-y-6">
            {/* Era Header */}
            <div className="border-b border-white/10 pb-4 flex flex-col md:flex-row md:items-baseline justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl uppercase font-light tracking-wider text-white">
                    {era.name}
                  </h2>
                  <span className="text-[9px] font-mono tracking-widest uppercase border border-white/10 px-2 py-0.5 text-white/40 bg-white/[0.01]">
                    {era.badge}
                  </span>
                </div>
                <p className="text-xs text-white/50 font-light max-w-2xl">{era.description}</p>
              </div>
              <span className="text-sm font-mono text-[var(--color-space-accent-2)]/80 self-start md:self-auto">
                {era.start} — {era.end}
              </span>
            </div>

            {/* Years Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
              {range(era.start, era.end).map((yr) => {
                const s = byYear.get(yr);
                const intensity = s ? 0.08 + (s.total_launches / maxCount) * 0.45 : 0;
                
                // Color intensity for backdrops
                const style = s
                  ? { backgroundColor: `rgba(91, 140, 255, ${intensity})` }
                  : undefined;

                return (
                  <Link
                    key={yr}
                    href={`/timeline/${yr}`}
                    className={`group relative aspect-square flex flex-col items-center justify-center border border-white/5 bg-white/[0.005] hover:border-[var(--color-space-accent-2)]/40 hover:bg-white/[0.02] hover:scale-[1.03] active:scale-[0.98] transition-all duration-300`}
                    style={style}
                  >
                    <span className="font-mono text-xs text-white/80 group-hover:text-white font-light group-hover:font-semibold tracking-wider transition-all">
                      {yr}
                    </span>
                    <span className="text-[10px] text-white/40 font-mono mt-1 group-hover:text-white/60">
                      {s ? `${s.total_launches} flt` : "—"}
                    </span>
                    {s && (
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--color-space-accent-2)]/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
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
