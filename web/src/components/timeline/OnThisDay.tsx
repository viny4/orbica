import Link from "next/link";
import type { LaunchRow } from "@/lib/api";
import { Outcome, StatusDot } from "@/components/ui";

// "On this day" highlight block. Outcomes come from the shared <Outcome>, which
// understands the stored lowercase values (the old "Success"/"Failure" string
// comparisons never matched, so no outcome was ever shown).
export function OnThisDay({ launches }: { launches: LaunchRow[] }) {
  if (!launches || launches.length === 0) return null;

  const dateStr = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(new Date());

  return (
    <section className="mb-16 border border-accent/25 bg-accent/[0.03] p-6 md:p-8" aria-labelledby="otd-title">
      <div className="mb-6 flex items-center gap-3 border-b border-accent/15 pb-4">
        <StatusDot tone="accent" pulse />
        <h2 id="otd-title" className="font-mono text-sm uppercase tracking-[0.2em] text-accent">
          On this day in orbital history
        </h2>
        <span className="ml-auto font-mono text-xs text-ink-3">{dateStr}</span>
      </div>

      <div className="grid grid-cols-1 gap-px bg-accent/15 sm:grid-cols-2 lg:grid-cols-3">
        {launches.slice(0, 3).map((l) => (
          <Link key={l.id} href={`/launches/${l.id}`} className="tile group p-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent-blue">{l.launch_year}</span>
              <Outcome outcome={l.outcome} />
            </div>
            <div className="truncate text-lg font-light transition-colors group-hover:text-accent">{l.name}</div>
            <div className="mt-2 truncate font-mono text-[11px] uppercase tracking-wide text-ink-4">
              {l.rocket_name || "Unknown rocket"} · {l.agency_abbrev || l.agency_name || "Unknown agency"}
            </div>
          </Link>
        ))}
      </div>
      {launches.length > 3 && (
        <div className="mt-4 text-center">
          <Link href="/on-this-day" className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-3 hover:text-ink">
            See every launch on this day →
          </Link>
        </div>
      )}
    </section>
  );
}
