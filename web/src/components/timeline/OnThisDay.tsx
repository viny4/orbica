import Link from "next/link";

export function OnThisDay({ launches }: { launches: any[] }) {
  if (!launches || launches.length === 0) return null;

  const today = new Date();
  const dateStr = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(today);

  return (
    <section className="mb-16 border border-[var(--color-space-accent-2)]/30 bg-[var(--color-space-accent-2)]/5 p-6 md:p-8">
      <div className="flex items-center gap-3 mb-6 border-b border-[var(--color-space-accent-2)]/20 pb-4">
        <div className="w-2 h-2 rounded-full bg-[var(--color-space-accent-2)] animate-pulse" />
        <h2 className="text-sm tracking-[0.2em] uppercase text-[var(--color-space-accent-2)] font-mono">
          On This Day in Orbital History
        </h2>
        <span className="ml-auto text-xs font-mono text-white/40">{dateStr}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--color-space-accent-2)]/20">
        {launches.slice(0, 3).map((l: any) => (
          <Link
            key={l.id}
            href={`/launches/${l.id}`}
            className="group block bg-[#06080f] p-5 hover:bg-[#0c1322] transition-colors"
          >
            <div className="text-[10px] tracking-[0.25em] uppercase text-[var(--color-space-accent)] font-mono mb-2">
              {l.launch_year}
            </div>
            <div className="font-light truncate group-hover:text-[var(--color-space-accent-2)] transition-colors text-lg">
              {l.name}
            </div>
            <div className="text-[11px] text-white/40 font-mono uppercase tracking-wide mt-2">
              {l.rocket_name || "Unknown Rocket"} · {l.agency_abbrev || l.agency_name || "Unknown Agency"}
            </div>
            {l.outcome === "Success" ? (
              <div className="mt-3 text-[10px] uppercase tracking-wider text-emerald-400">Success</div>
            ) : l.outcome === "Failure" ? (
              <div className="mt-3 text-[10px] uppercase tracking-wider text-red-400">Failure</div>
            ) : null}
          </Link>
        ))}
      </div>
      {launches.length > 3 && (
        <div className="mt-4 text-center">
          <span className="text-[10px] tracking-[0.2em] uppercase text-white/30 font-mono">
            + {launches.length - 3} more launches on this day
          </span>
        </div>
      )}
    </section>
  );
}
