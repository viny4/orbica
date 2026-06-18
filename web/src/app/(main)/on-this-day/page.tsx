export const runtime = "edge";
import { api } from "@/lib/api";
import { PageHeader, tileClass } from "@/components/ui";
import { safe } from "@/components/EmptyState";
import Link from "next/link";

export default async function OnThisDayPage() {
  const launches = await safe(api.onThisDay(), []);
  
  const today = new Date();
  const dateStr = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(today);

  return (
    <div>
      <PageHeader
        eyebrow="Historical Archive"
        title={`On This Day: ${dateStr}`}
        meta={`Discover the orbital launches that happened exactly on this date over the past 70 years of spaceflight history.`}
      />

      {launches.length === 0 ? (
        <div className="py-20 text-center text-white/40 tracking-widest uppercase font-mono text-sm">
          No recorded orbital launches on this date.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {launches.map((l: any) => (
            <Link key={l.id} href={`/launches/${l.id}`} className={tileClass}>
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] uppercase tracking-widest text-[var(--color-space-accent)] font-mono">
                      {l.launch_year}
                    </span>
                    {l.outcome === "Success" ? (
                      <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-mono">Success</span>
                    ) : l.outcome === "Failure" ? (
                      <span className="text-[10px] uppercase tracking-wider text-red-400 font-mono">Failure</span>
                    ) : null}
                  </div>
                  
                  <h3 className="text-xl font-light mb-2 group-hover:text-[var(--color-space-accent-2)] transition-colors">
                    {l.name}
                  </h3>
                  
                  <div className="mt-auto pt-4 flex flex-col gap-1">
                    <span className="text-xs text-white/50">{l.rocket_name || "Unknown Rocket"}</span>
                    <span className="text-[10px] tracking-wider uppercase font-mono text-white/30">
                      {l.agency_name || "Unknown Agency"}
                    </span>
                  </div>
                </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
