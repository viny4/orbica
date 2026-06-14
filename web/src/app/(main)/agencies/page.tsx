import Link from "next/link";
import { api } from "@/lib/api";
import { EmptyState, safe } from "@/components/EmptyState";
import { PageHeader } from "@/components/ui";
import { Flag } from "@/components/Flag";
import { AgencyLogo } from "@/components/AgencyLogo";
import { country } from "@/lib/flags";

export const metadata = { title: "Agencies — Orbica" };

export default async function AgenciesPage() {
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
  const groups = [...byCountry.values()].sort((a, b) => b.total - a.total);

  return (
    <div>
      <PageHeader
        eyebrow="Operators · by nation"
        title="Agencies"
        meta={`${agencies.length} agencies across ${groups.length} nations`}
      />

      {agencies.length === 0 ? (
        <EmptyState message="No agencies yet — run the seed." />
      ) : (
        <div className="space-y-12">
          {groups.map((g) => (
            <section key={g.code}>
              <div className="flex items-center gap-4 mb-5 border-b border-white/10 pb-3">
                <Flag code={g.code} className="w-10 h-7 rounded-sm" />
                <h2 className="text-lg font-light uppercase tracking-[0.18em]">{g.name}</h2>
                <span className="ml-auto text-[11px] tracking-[0.2em] uppercase text-white/35 font-mono">
                  {g.agencies.length} {g.agencies.length === 1 ? "agency" : "agencies"} · {g.total} launches
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5">
                {g.agencies
                  .sort((a, b) => (b.total_launches ?? 0) - (a.total_launches ?? 0))
                  .map((a) => (
                    <Link
                      key={a.id}
                      href={`/agencies/${a.slug}`}
                      className="group flex items-center gap-3 bg-[#06080f] p-4 hover:bg-[#0c1322] transition-colors"
                    >
                      <div className="relative flex-shrink-0">
                        <AgencyLogo src={a.logo_url} name={a.name} className="w-12 h-12" />
                        <Flag
                          code={a.country_code}
                          className="absolute -bottom-1 -right-1 w-4 h-3 rounded-[2px] ring-1 ring-[#06080f]"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-light truncate group-hover:text-[var(--color-space-accent-2)] transition-colors">
                          {a.abbrev || a.name}
                        </div>
                        <div className="text-[11px] text-white/40 font-mono uppercase tracking-wide truncate">
                          {a.agency_type ?? "agency"}
                        </div>
                      </div>
                      <div className="font-mono text-lg font-light text-white/60 tabular-nums">
                        {a.total_launches}
                      </div>
                    </Link>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
