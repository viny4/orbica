import Link from "next/link";
import { api } from "@/lib/api";
import { EmptyState, safe } from "@/components/EmptyState";
import { PageHeader } from "@/components/ui";
import { OnThisDay } from "@/components/timeline/OnThisDay";
import { LaunchHistogram } from "@/components/home/LaunchHistogram";

export const runtime = "edge";

export const metadata = {
  title: "Timeline — Orbica",
  description: "Every orbital launch since Sputnik in 1957, decade by decade and year by year.",
};

// Era labels give each decade its historical context.
const ERAS: Record<number, string> = {
  2020: "Commercial expansion & megaconstellations",
  2010: "The reusability revolution",
  2000: "ISS construction & maturation",
  1990: "Post-Cold War cooperation",
  1980: "Shuttle era & commercial beginnings",
  1970: "Apollo–Soyuz & space stations",
  1960: "The space race & Apollo",
  1950: "The dawn of the space age",
};

export default async function TimelinePage() {
  // Independent requests — fetched together, not one after the other.
  const [years, onThisDayLaunches] = await Promise.all([safe(api.timelineYears(), []), safe(api.onThisDay(), [])]);

  const byDecade = new Map<number, typeof years>();
  let maxLaunchesInYear = 1;
  for (const y of years) {
    maxLaunchesInYear = Math.max(maxLaunchesInYear, y.total_launches);
    const d = Math.floor(y.launch_year / 10) * 10;
    if (!byDecade.has(d)) byDecade.set(d, []);
    byDecade.get(d)!.push(y);
  }
  const decades = [...byDecade.keys()].sort((a, b) => b - a);
  const total = years.reduce((n, y) => n + y.total_launches, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Orbital record system"
        title="Orbital Timeline"
        meta={total ? `${total.toLocaleString("en-US")} launches catalogued since Sputnik (1957)` : "Cataloguing every flight since Sputnik (1957)"}
      />

      {years.length > 0 && (
        <div className="card mb-14 p-5 sm:p-7">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.28em] text-ink-3">Launches per year</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-4">Peak year highlighted</span>
          </div>
          <LaunchHistogram years={years} />
        </div>
      )}

      <OnThisDay launches={onThisDayLaunches} />

      {years.length === 0 ? (
        <EmptyState message="Timeline data is unavailable right now — please try again shortly." />
      ) : (
        <div className="space-y-16">
          {decades.map((d) => (
            <section key={d} aria-labelledby={`decade-${d}`}>
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line pb-3">
                <h2 id={`decade-${d}`} className="text-xl font-light tracking-wide">{d}s</h2>
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent/80">{ERAS[d] ?? ""}</span>
              </div>

              <div className="tile-grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {byDecade.get(d)!.map((y) => {
                  const intensity = Math.min(y.total_launches / maxLaunchesInYear, 1);
                  return (
                    <Link
                      key={y.launch_year}
                      href={`/timeline/${y.launch_year}`}
                      className="tile group relative flex min-h-[132px] flex-col justify-between overflow-hidden p-5 sm:p-6"
                    >
                      {/* Heat fill: brighter years launched more. */}
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-accent/25 to-transparent transition-opacity duration-500 group-hover:opacity-100"
                        style={{ height: `${18 + intensity * 82}%`, opacity: 0.25 + intensity * 0.55 }}
                      />
                      <div className="relative text-3xl font-extralight tracking-tighter text-ink transition-colors group-hover:text-accent">
                        {y.launch_year}
                      </div>
                      <div className="relative mt-auto">
                        <div className="font-mono text-sm text-ink-2">{y.total_launches}</div>
                        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-4">
                          flights{y.failures ? ` · ${y.failures} failed` : ""}
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
