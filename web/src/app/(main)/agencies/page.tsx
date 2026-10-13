import Link from "next/link";
import type { Metadata } from "next";
export const runtime = "edge";

import { api } from "@/lib/api";
import { EmptyState, safe } from "@/components/EmptyState";
import { PageHeader } from "@/components/ui";
import { Flag } from "@/components/Flag";
import { AgencyLogo } from "@/components/AgencyLogo";
import { country } from "@/lib/flags";

export const metadata: Metadata = {
  title: "Agencies — Orbica",
  description: "Space agencies and launch operators worldwide, grouped by nation and ranked by launch activity.",
};

export default async function AgenciesPage({ searchParams }: { searchParams: { sort?: string } }) {
  const sort = searchParams.sort === "name" ? "name" : "launches";
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
  groups.sort(sort === "name" ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b.total - a.total);
  for (const g of groups) {
    g.agencies.sort((a, b) =>
      sort === "name" ? (a.abbrev || a.name).localeCompare(b.abbrev || b.name) : (b.total_launches ?? 0) - (a.total_launches ?? 0),
    );
  }

  const sortLink = (key: "launches" | "name", label: string) => (
    <Link
      href={key === "launches" ? "/agencies" : "/agencies?sort=name"}
      scroll={false}
      aria-current={sort === key ? "page" : undefined}
      className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
        sort === key ? "bg-accent/15 text-accent" : "text-ink-3 hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Operators · by nation"
        title="Agencies"
        meta={`${agencies.length} agencies across ${groups.length} nations`}
        actions={
          <div className="flex items-center gap-1 border border-line p-1" role="group" aria-label="Sort">
            {sortLink("launches", "By launches")}
            {sortLink("name", "A–Z")}
          </div>
        }
      />

      {agencies.length === 0 ? (
        <EmptyState message="The agency directory is unavailable right now — please try again shortly." />
      ) : (
        <div className="space-y-12">
          {groups.map((g) => {
            const isSoviet = g.code === "SUN";
            return (
              <section key={g.code} id={`nation-${g.code.toLowerCase()}`} className="scroll-mt-24">
                <div className={`mb-5 flex items-center gap-4 border-b pb-3 ${isSoviet ? "border-danger/30" : "border-line"}`}>
                  <Flag code={g.code} className="h-7 w-10 rounded-sm" />
                  <h2 className={`text-lg font-light uppercase tracking-[0.18em] ${isSoviet ? "text-danger" : ""}`}>{g.name}</h2>
                  <span className={`ml-auto font-mono text-[11px] uppercase tracking-[0.2em] ${isSoviet ? "text-danger/60" : "text-ink-4"}`}>
                    {g.agencies.length} {g.agencies.length === 1 ? "agency" : "agencies"} · {g.total.toLocaleString("en-US")} launches
                  </span>
                </div>
                <div className="tile-grid sm:grid-cols-2 lg:grid-cols-3">
                  {g.agencies.map((a) => (
                    <Link
                      key={a.id}
                      href={`/agencies/${a.slug}`}
                      className={`tile group flex items-center gap-3 p-4 ${isSoviet ? "!bg-[#140808] hover:!bg-[#220c0c]" : ""}`}
                    >
                      <div className="relative shrink-0">
                        <AgencyLogo src={a.logo_url} name={a.name} className="h-12 w-12" />
                        <Flag code={a.country_code} className="absolute -bottom-1 -right-1 h-3 w-4 rounded-[2px] ring-1 ring-surface" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`truncate font-light transition-colors ${isSoviet ? "group-hover:text-danger" : "group-hover:text-accent"}`}>
                          {a.abbrev || a.name}
                        </div>
                        <div className="truncate font-mono text-[11px] uppercase tracking-wide text-ink-4">{a.agency_type ?? "agency"}</div>
                      </div>
                      <div className="font-mono text-lg font-light tabular-nums text-ink-2">{a.total_launches}</div>
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
