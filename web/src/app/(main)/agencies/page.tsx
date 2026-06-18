import Link from "next/link";
export const runtime = "edge";

import { api } from "@/lib/api";
import { EmptyState, safe } from "@/components/EmptyState";
import { PageHeader } from "@/components/ui";
import { Flag } from "@/components/Flag";
import { AgencyLogo } from "@/components/AgencyLogo";
import { country } from "@/lib/flags";

export const metadata = { title: "Agencies — Orbica" };

export default async function AgenciesPage({
  searchParams,
}: {
  searchParams: { sort?: string };
}) {
  const sort = searchParams.sort || "launches";
  const agencies = await safe(api.agencies(), []);

  // Group by nation, ordered by total launch activity.
  const byCountry = new Map<string, { code: string; name: string; agencies: typeof agencies; total: number }>();
  for (const a of agencies) {
    const code = a.country_code && a.country_code !== "???" ? a.country_code : "OTHER";
    const name = country(code)?.name ?? "Other / International";
    if (!byCountry.has(code)) byCountry.set(code, { code, name, agencies: [], total: 0 });
    const g = byCountry.get(code)!;
    g.agencies.push(a);
    g.total += a.total_launches ?? 0;
  }
  
  const groups = [...byCountry.values()];
  if (sort === "name") {
    groups.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    groups.sort((a, b) => b.total - a.total);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Operators · by nation"
        title="Agencies"
        meta={`${agencies.length} agencies across ${groups.length} nations`}
      />

      <div className="flex justify-end mb-8">
        <div className="flex items-center gap-1 bg-[#06080f] border border-white/10 p-1 rounded-sm">
          <Link
            href="/agencies?sort=launches"
            className={`px-3 py-1.5 text-[10px] uppercase font-mono tracking-wider rounded-sm transition-colors ${sort !== "name" ? "bg-[var(--color-space-accent-2)]/20 text-[var(--color-space-accent-2)]" : "text-white/40 hover:text-white"}`}
          >
            Sort by Count
          </Link>
          <Link
            href="/agencies?sort=name"
            className={`px-3 py-1.5 text-[10px] uppercase font-mono tracking-wider rounded-sm transition-colors ${sort === "name" ? "bg-[var(--color-space-accent-2)]/20 text-[var(--color-space-accent-2)]" : "text-white/40 hover:text-white"}`}
          >
            Sort A-Z
          </Link>
        </div>
      </div>

      {agencies.length === 0 ? (
        <EmptyState message="No agencies yet — run the seed." />
      ) : (
        <div className="space-y-12">
          {groups.map((g) => {
            const isSoviet = g.code === "SUN";
            return (
              <section key={g.code}>
                <div className={`flex items-center gap-4 mb-5 border-b pb-3 ${isSoviet ? "border-red-900/50" : "border-white/10"}`}>
                  <Flag code={g.code} className="w-10 h-7 rounded-sm" />
                  <h2 className={`text-lg font-light uppercase tracking-[0.18em] ${isSoviet ? "text-red-400" : ""}`}>
                    {g.name}
                  </h2>
                  <span className={`ml-auto text-[11px] tracking-[0.2em] uppercase font-mono ${isSoviet ? "text-red-400/50" : "text-white/35"}`}>
                    {g.agencies.length} {g.agencies.length === 1 ? "agency" : "agencies"} · {g.total} launches
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5">
                  {g.agencies
                    .sort((a, b) => sort === "name" 
                      ? (a.abbrev || a.name).localeCompare(b.abbrev || b.name) 
                      : (b.total_launches ?? 0) - (a.total_launches ?? 0)
                    )
                    .map((a) => (
                      <Link
                        key={a.id}
                        href={`/agencies/${a.slug}`}
                        className={`group flex items-center gap-3 p-4 transition-colors ${isSoviet ? "bg-[#1a0808] hover:bg-[#2a0c0c]" : "bg-[#06080f] hover:bg-[#0c1322]"}`}
                      >
                        <div className="relative flex-shrink-0">
                          <AgencyLogo src={a.logo_url} name={a.name} className="w-12 h-12" />
                          <Flag
                            code={a.country_code}
                            className={`absolute -bottom-1 -right-1 w-4 h-3 rounded-[2px] ring-1 ${isSoviet ? "ring-[#1a0808]" : "ring-[#06080f]"}`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`font-light truncate transition-colors ${isSoviet ? "group-hover:text-red-400" : "group-hover:text-[var(--color-space-accent-2)]"}`}>
                            {a.abbrev || a.name}
                          </div>
                          <div className={`text-[11px] font-mono uppercase tracking-wide truncate ${isSoviet ? "text-red-400/50" : "text-white/40"}`}>
                            {a.agency_type ?? "agency"}
                          </div>
                        </div>
                        <div className={`font-mono text-lg font-light tabular-nums ${isSoviet ? "text-red-400/70" : "text-white/60"}`}>
                          {a.total_launches}
                        </div>
                      </Link>
                    ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
