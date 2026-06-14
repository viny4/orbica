import Link from "next/link";
import { api } from "@/lib/api";
import { safe } from "@/components/EmptyState";
import { Flag } from "@/components/Flag";
import { AgencyLogo } from "@/components/AgencyLogo";
import { country } from "@/lib/flags";

type Agency = Record<string, any>;

export default async function AgencyDetailPage({ params }: { params: { id: string } }) {
  const a = (await safe<Agency | null>(api.agency(params.id), null)) as Agency | null;
  if (!a) {
    return (
      <div>
        <Link href="/agencies" className="text-[11px] tracking-[0.25em] uppercase text-white/45 hover:text-white">
          ← Agencies
        </Link>
        <h1 className="mt-6 text-5xl font-light uppercase tracking-tight">Not found</h1>
      </div>
    );
  }
  const rockets: any[] = Array.isArray(a.rockets) ? a.rockets : [];
  const nation = country(a.country_code);

  return (
    <div>
      <header className="mb-12">
        <Link
          href="/agencies"
          className="inline-block mb-6 text-[11px] tracking-[0.25em] uppercase text-white/45 hover:text-white transition-colors"
        >
          ← Agencies
        </Link>
        <div className="flex items-start gap-6">
          <AgencyLogo src={a.logo_url} name={String(a.name)} className="w-24 h-24" />
          <div>
            <p className="flex items-center gap-2 text-[11px] tracking-[0.35em] uppercase text-[var(--color-space-accent-2)]/75">
              <Flag code={a.country_code} className="w-5 h-3.5 rounded-[2px]" />
              {nation?.name ?? "International"} · {a.agency_type ?? "Agency"}
            </p>
            <h1 className="mt-3 font-light uppercase leading-[0.95] tracking-tight text-5xl sm:text-6xl lg:text-7xl">
              {a.name}
            </h1>
            <div className="mt-5 text-sm text-white/50 font-mono tabular-nums">
              {a.total_launches ?? 0} launches
              {a.founding_year ? ` · est. ${a.founding_year}` : ""}
            </div>
          </div>
        </div>
      </header>

      {a.description && (
        <p className="max-w-3xl text-white/55 leading-relaxed font-light mb-14">{String(a.description)}</p>
      )}

      <section>
        <h2 className="text-[11px] tracking-[0.3em] uppercase text-white/45 mb-5 border-b border-white/10 pb-3">
          Vehicles
        </h2>
        {rockets.length === 0 ? (
          <p className="text-white/40 text-sm">No vehicles linked yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5">
            {rockets.map((r) => (
              <Link
                key={r.id}
                href={`/rockets/${r.slug}`}
                className="group block bg-[#06080f] p-5 hover:bg-[#0c1322] transition-colors"
              >
                <div className="font-light group-hover:text-[var(--color-space-accent-2)] transition-colors">
                  {r.name}
                </div>
                <div className="text-[11px] text-white/40 font-mono uppercase tracking-wide mt-1">
                  {r.status ?? "unknown"} · {r.total_launches ?? 0} launches
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
