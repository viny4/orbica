import Link from "next/link";
import { api } from "@/lib/api";
import { safe } from "@/components/EmptyState";
import { Flag } from "@/components/Flag";
import { AgencyLogo } from "@/components/AgencyLogo";
import { Outcome } from "@/components/ui";
import { country } from "@/lib/flags";

export const runtime = "edge";

type Agency = Record<string, any>;

const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "TBD";

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
  const flown: any[] = Array.isArray(a.flown) ? a.flown : [];
  const launches: any[] = Array.isArray(a.launches) ? a.launches : [];
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

      {/* Vehicles this agency BUILT (manufacturers) */}
      {rockets.length > 0 && (
        <section className="mb-14">
          <h2 className="text-[11px] tracking-[0.3em] uppercase text-white/45 mb-5 border-b border-white/10 pb-3">
            Vehicles built · {rockets.length}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5">
            {rockets.map((r) => (
              <Link key={r.id} href={`/rockets/${r.slug}`}
                className="group block bg-[#06080f] p-5 hover:bg-[#0c1322] transition-colors">
                <div className="font-light group-hover:text-[var(--color-space-accent-2)] transition-colors">{r.name}</div>
                <div className="text-[11px] text-white/40 font-mono uppercase tracking-wide mt-1">
                  {r.status ?? "unknown"} · {r.total_launches ?? 0} launches
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Vehicles this agency has FLOWN (operators) */}
      {flown.length > 0 && (
        <section className="mb-14">
          <h2 className="text-[11px] tracking-[0.3em] uppercase text-white/45 mb-5 border-b border-white/10 pb-3">
            Vehicles flown · {flown.length}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5">
            {flown.map((v) => (
              <Link key={v.id} href={`/rockets/${v.slug}`}
                className="group flex items-center justify-between gap-3 bg-[#06080f] p-5 hover:bg-[#0c1322] transition-colors">
                <div>
                  <div className="font-light group-hover:text-[var(--color-space-accent-2)] transition-colors">{v.name}</div>
                  <div className="text-[11px] text-white/40 font-mono uppercase tracking-wide mt-1">{v.status ?? "unknown"}</div>
                </div>
                <div className="font-mono text-sm text-white/55 shrink-0">{v.cnt}×</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Full launch history */}
      {launches.length > 0 && (
        <section>
          <h2 className="text-[11px] tracking-[0.3em] uppercase text-white/45 mb-5 border-b border-white/10 pb-3">
            Launch history · {launches.length}
          </h2>
          <ul className="divide-y divide-white/10 border-y border-white/10">
            {launches.map((l) => (
              <li key={l.id}>
                <Link href={`/launches/${l.id}`}
                  className="group flex items-center justify-between gap-4 py-3.5 hover:bg-white/[0.02] transition-colors -mx-2 px-2">
                  <div className="min-w-0">
                    <div className="font-light truncate group-hover:text-[var(--color-space-accent-2)] transition-colors">
                      {l.mission_name || l.name}
                    </div>
                    <div className="text-[11px] text-white/40 font-mono uppercase tracking-wide mt-0.5 truncate">
                      {l.rocket_name ?? "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 text-right">
                    {l.outcome && <Outcome outcome={l.outcome} />}
                    <span className="font-mono text-xs text-white/45 tabular-nums w-24 text-right hidden sm:inline">
                      {fmtDate(l.launch_time)}
                    </span>
                    <span className="font-mono text-xs text-white/45 tabular-nums sm:hidden">{l.launch_year}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rockets.length === 0 && flown.length === 0 && launches.length === 0 && (
        <p className="text-white/40 text-sm">No vehicles or launches linked yet.</p>
      )}
    </div>
  );
}
