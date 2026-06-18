import Link from "next/link";
import { api } from "@/lib/api";
import { EmptyState, safe } from "@/components/EmptyState";
import { PageHeader } from "@/components/ui";
import { OnThisDay } from "@/components/timeline/OnThisDay";

export const runtime = "edge";

export const metadata = { title: "Timeline — Orbica" };

// A small helper to scale color intensity
function getHeatmapOpacity(count: number, max: number) {
  // Base opacity of 0.15, max of 1.0 depending on launch count
  const normalized = Math.min(count / Math.max(1, max), 1);
  return 0.15 + (0.85 * normalized);
}

export default async function TimelinePage() {
  const years = await safe(api.timelineYears(), []);
  const onThisDayLaunches = await safe(api.onThisDay(), []);

  // Compute decades
  const byDecade = new Map<number, typeof years>();
  let maxLaunchesInYear = 1;
  
  for (const y of years) {
    if (y.total_launches > maxLaunchesInYear) {
      maxLaunchesInYear = y.total_launches;
    }
    const d = Math.floor(y.launch_year / 10) * 10;
    if (!byDecade.has(d)) byDecade.set(d, []);
    byDecade.get(d)!.push(y);
  }

  const decades = [...byDecade.keys()].sort((a, b) => b - a);

  // Era labels to give historical context
  const ERAS: Record<number, string> = {
    2020: "COMMERCIAL EXPANSION & MEGACONSTELLATIONS",
    2010: "THE REUSABILITY REVOLUTION",
    2000: "ISS CONSTRUCTION & MATURATION",
    1990: "POST-COLD WAR COOPERATION",
    1980: "SHUTTLE ERA & COMMERCIAL BEGINNINGS",
    1970: "APOLLO-SOYUZ & SPACE STATIONS",
    1960: "THE SPACE RACE & APOLLO",
    1950: "THE DAWN OF THE SPACE AGE",
  };

  return (
    <div>
      <PageHeader
        eyebrow="Orbital Record System"
        title="Orbital Timeline"
        meta={`Cataloguing every flight since Sputnik (1957)`}
      />

      <OnThisDay launches={onThisDayLaunches} />

      {years.length === 0 ? (
        <EmptyState message="No timeline data — run the historical seed." />
      ) : (
        <div className="space-y-16">
          {decades.map((d) => (
            <section key={d}>
              <div className="flex items-baseline justify-between mb-5 border-b border-white/10 pb-3">
                <h2 className="text-xl font-light tracking-wide">{d}s</h2>
                <span className="text-[10px] tracking-[0.25em] uppercase text-[var(--color-space-accent-2)]/80 font-mono">
                  {ERAS[d] ?? ""}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-px bg-white/5">
                {byDecade.get(d)!.map((y) => {
                  const opacity = getHeatmapOpacity(y.total_launches, maxLaunchesInYear);
                  return (
                    <Link
                      key={y.launch_year}
                      href={`/timeline/${y.launch_year}`}
                      className="group relative bg-[#06080f] p-6 hover:bg-[#0c1322] transition-colors flex flex-col justify-between min-h-[140px] overflow-hidden"
                    >
                      {/* Heatmap background block */}
                      <div 
                        className="absolute inset-0 bg-[var(--color-space-accent-2)] mix-blend-screen transition-opacity duration-500 pointer-events-none" 
                        style={{ opacity: opacity * 0.2, zIndex: 0 }} 
                      />

                      <div className="relative z-10 text-3xl font-extralight tracking-tighter text-white group-hover:text-[var(--color-space-accent-2)] transition-colors">
                        {y.launch_year}
                      </div>
                      
                      <div className="relative z-10 mt-auto">
                        <div className="text-sm font-mono text-white/70">
                          {y.total_launches}
                        </div>
                        <div className="text-[10px] tracking-[0.2em] uppercase text-white/30 font-mono mt-0.5">
                          flights
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function range(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}
