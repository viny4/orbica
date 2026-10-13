import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { api, getLaunchTitle } from "@/lib/api";
import { JsonLd, breadcrumbSchema } from "@/components/JsonLd";
import { Flag } from "@/components/Flag";
import { AgencyLogo } from "@/components/AgencyLogo";
import { Outcome, SectionHeader } from "@/components/ui";
import { country } from "@/lib/flags";

export const runtime = "edge";

type Agency = Record<string, any>;

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const a = await api.agency(params.id).catch(() => undefined);
  if (a === null) notFound();
  if (!a) return { title: "Agency — Orbica" };
  return {
    title: `${a.name} — Orbica`,
    description: `${a.name} is a ${a.agency_type?.toLowerCase() ?? "space agency"} based in ${country(a.country_code)?.name ?? "Unknown"}. View their launch history and vehicles on Orbica.`,
    alternates: { canonical: `https://orbica.space/agencies/${a.slug || params.id}` },
  };
}

const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : "TBD";

export default async function AgencyDetailPage({ params }: { params: { id: string } }) {
  const a = (await api.agency(params.id)) as Agency | null;
  if (!a) notFound();

  const rockets: any[] = Array.isArray(a.rockets) ? a.rockets : [];
  const flown: any[] = Array.isArray(a.flown) ? a.flown : [];
  const launches: any[] = Array.isArray(a.launches) ? a.launches : [];
  const nation = country(a.country_code);

  return (
    <div>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Agencies", path: "/agencies" },
          { name: String(a.name), path: `/agencies/${a.slug || params.id}` },
        ])}
      />
      <header className="mb-12">
        <Link
          href="/agencies"
          className="group mb-6 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-3 transition-colors hover:text-ink"
        >
          <span aria-hidden className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
          Agencies
        </Link>
        <div className="flex items-start gap-5 sm:gap-7">
          <AgencyLogo src={a.logo_url} name={String(a.name)} className="h-16 w-16 sm:h-24 sm:w-24" />
          <div className="min-w-0">
            <p className="eyebrow flex items-center gap-2">
              <Flag code={a.country_code} className="h-3.5 w-5 rounded-[2px]" />
              {nation?.name ?? "International"} · {a.agency_type ?? "Agency"}
            </p>
            <h1 className="mt-3 text-title font-light uppercase tracking-tight text-balance break-words">{a.name}</h1>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-mono text-sm tabular-nums text-ink-3">
              <span><span className="text-ink">{a.total_launches ?? 0}</span> launches</span>
              {a.founding_year && <span>est. {a.founding_year}</span>}
              {a.website && (
                <a href={a.website} target="_blank" rel="noopener noreferrer" className="text-accent/80 hover:text-accent">
                  Website ↗
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      {a.description && <p className="mb-14 max-w-3xl font-light leading-relaxed text-ink-2">{String(a.description)}</p>}

      {/* Vehicles this agency BUILT (manufacturers) */}
      {rockets.length > 0 && (
        <section className="mb-14">
          <SectionHeader title="Vehicles built" count={rockets.length} />
          <div className="tile-grid sm:grid-cols-2 lg:grid-cols-3">
            {rockets.map((r) => (
              <Link key={r.id} href={`/rockets/${r.slug}`} className="tile group p-5">
                <div className="font-light transition-colors group-hover:text-accent">{r.name}</div>
                <div className="mt-1 font-mono text-[11px] uppercase tracking-wide text-ink-4">
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
          <SectionHeader title="Vehicles flown" count={flown.length} />
          <div className="tile-grid sm:grid-cols-2 lg:grid-cols-3">
            {flown.map((v) => (
              <Link key={v.id} href={`/rockets/${v.slug}`} className="tile group flex items-center justify-between gap-3 p-5">
                <div className="min-w-0">
                  <div className="truncate font-light transition-colors group-hover:text-accent">{v.name}</div>
                  <div className="mt-1 font-mono text-[11px] uppercase tracking-wide text-ink-4">{v.status ?? "unknown"}</div>
                </div>
                <div className="shrink-0 font-mono text-sm text-ink-3">{v.cnt}×</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Launch history (newest 200) */}
      {launches.length > 0 && (
        <section>
          <SectionHeader title="Launch history" count={launches.length} />
          <ul className="divide-y divide-line border-y border-line">
            {launches.map((l) => (
              <li key={l.id}>
                <Link href={`/launches/${l.id}`} className="group -mx-2 flex items-center justify-between gap-4 px-2 py-3.5 transition-colors hover:bg-white/[0.02]">
                  <div className="min-w-0">
                    <div className="truncate font-light transition-colors group-hover:text-accent">
                      {getLaunchTitle(l.mission_name, l.name, l.rocket_name)}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11px] uppercase tracking-wide text-ink-4">{l.rocket_name ?? "—"}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-right">
                    {l.outcome && <Outcome outcome={l.outcome} />}
                    <span className="hidden w-24 text-right font-mono text-xs tabular-nums text-ink-3 sm:inline">{fmtDate(l.launch_time)}</span>
                    <span className="font-mono text-xs tabular-nums text-ink-3 sm:hidden">{l.launch_year}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rockets.length === 0 && flown.length === 0 && launches.length === 0 && (
        <p className="text-sm text-ink-3">No vehicles or launches linked yet.</p>
      )}
    </div>
  );
}
