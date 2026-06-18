import Link from "next/link";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { safe } from "@/components/EmptyState";
import { PageHeader, Chip } from "@/components/ui";
import { News } from "@/components/News";
import { ClientRocketPayloads } from "@/components/rockets/ClientRocketPayloads";

export const runtime = "edge";

// Visual (real photo + interactive 3D) is client-only — never SSR it.
const RocketVisual = dynamic(() => import("@/components/rockets/RocketVisual"), {
  ssr: false,
  loading: () => (
    <div className="w-full aspect-square border border-white/10 bg-white/[0.015] grid place-items-center text-white/45 text-sm">
      Loading…
    </div>
  ),
});

type Rocket = Record<string, any>;

export default async function RocketDetailPage({ params }: { params: { id: string } }) {
  const [rocket, articles, payloads] = await Promise.all([
    safe<Rocket | null>(api.rocket(params.id), null),
    safe(api.rocketArticles(params.id), []),
    safe(api.rocketPayloads(params.id), []), // now fetches up to 60 by default
  ]);

  if (!rocket) {
    return <PageHeader title="Not found" back={{ href: "/rockets", label: "Rockets" }} />;
  }

  const specs: [string, unknown][] = [
    ["Status", rocket.status],
    ["Height", rocket.height_m && `${rocket.height_m} m`],
    ["Diameter", rocket.diameter_m && `${rocket.diameter_m} m`],
    ["Mass", rocket.mass_kg && `${Number(rocket.mass_kg).toLocaleString()} kg`],
    ["Stages", rocket.stages],
    ["Thrust", rocket.thrust_kn && `${Number(rocket.thrust_kn).toLocaleString()} kN`],
    ["Payload to LEO", rocket.payload_leo_kg && `${Number(rocket.payload_leo_kg).toLocaleString()} kg`],
    ["Payload to GTO", rocket.payload_gto_kg && `${Number(rocket.payload_gto_kg).toLocaleString()} kg`],
    ["First flight", rocket.first_flight],
    ["Total launches", rocket.total_launches],
    ["Success / Fail", `${rocket.successful_launches ?? 0} / ${rocket.failed_launches ?? 0}`],
  ];

  const family = rocket.family?.name as string | undefined;
  const manufacturer = rocket.manufacturer?.name as string | undefined;
  const manufacturerSlug = rocket.manufacturer?.slug as string | undefined;

  const eyebrowContent = (
    <span className="flex items-center gap-1.5 uppercase">
      {family ? <span>{family}</span> : null}
      {family && manufacturer ? <span className="text-white/20">·</span> : null}
      {manufacturer ? (
        manufacturerSlug ? (
          <Link href={`/agencies/${manufacturerSlug}`} className="hover:text-white transition-colors">
            {manufacturer}
          </Link>
        ) : (
          <span>{manufacturer}</span>
        )
      ) : null}
      {!family && !manufacturer && <span>Launch Vehicle</span>}
    </span>
  );

  // Group engines by stage for the propulsion breakdown.
  const STAGE_LABEL: Record<number, string> = {
    0: "Boosters",
    1: "First stage",
    2: "Second stage",
    3: "Third stage",
  };
  const engines = (rocket.engines ?? []) as Record<string, any>[];
  const stages = [...new Set(engines.map((e) => e.stage as number))].sort((a, b) => a - b);
  const thrustOf = (e: Record<string, any>) => e.thrust_sl_kn ?? e.thrust_vac_kn;

  return (
    <div>
      <PageHeader
        eyebrow={eyebrowContent}
        title={String(rocket.name)}
        back={{ href: "/rockets", label: "Rockets" }}
        meta={
          <span className="flex items-center gap-2">
            <Chip>{rocket.status ?? "unknown"}</Chip>
            {rocket.reusable && <Chip tone="accent">Reusable</Chip>}
          </span>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <RocketVisual
          imageUrl={rocket.image_url}
          spec={{
            name: String(rocket.name),
            family: family,
            height_m: rocket.height_m,
            diameter_m: rocket.diameter_m,
            stages: rocket.stages,
            thrust_kn: rocket.thrust_kn,
            reusable: rocket.reusable,
            engineCount: engines
              .filter((e) => e.stage === 1)
              .reduce((n, e) => n + (Number(e.engine_count) || 0), 0),
          }}
        />

        <div>
          <h2 className="text-[11px] tracking-[0.3em] uppercase text-white/45 mb-5">Specifications</h2>
          <dl className="divide-y divide-white/10 border-y border-white/10">
            {specs
              .filter(([, v]) => v !== null && v !== undefined && v !== "")
              .map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-3">
                  <dt className="text-[13px] tracking-wide text-white/45">{k}</dt>
                  <dd className="font-mono text-sm">{String(v)}</dd>
                </div>
              ))}
          </dl>
        </div>
      </div>

      {rocket.description && (
        <p className="mt-10 max-w-3xl text-white/55 leading-relaxed font-light">
          {String(rocket.description)}
        </p>
      )}

      {engines.length > 0 && (
        <section className="mt-16">
          <h2 className="text-[11px] tracking-[0.3em] uppercase text-white/45 mb-5 border-b border-white/10 pb-3">
            Propulsion
          </h2>
          <div className="space-y-8">
            {stages.map((st) => (
              <div key={st}>
                <h3 className="text-[10px] tracking-[0.25em] uppercase text-[var(--color-space-accent-2)]/80 mb-3">
                  {STAGE_LABEL[st] ?? `Stage ${st}`}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/5">
                  {engines
                    .filter((e) => e.stage === st)
                    .map((e, i) => (
                      <div key={i} className="bg-[#06080f] p-4">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-light">
                            {e.engine_count > 1 && (
                              <span className="text-[var(--color-space-accent-2)] font-mono mr-1.5">
                                {e.engine_count}×
                              </span>
                            )}
                            {e.name}
                          </span>
                          {thrustOf(e) && (
                            <span className="font-mono text-xs text-white/50 shrink-0">
                              {Number(thrustOf(e)).toLocaleString()} kN
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-white/40 font-mono uppercase tracking-wide mt-1.5">
                          {[e.propellant, e.cycle].filter(Boolean).join(" · ")}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/35 mt-2">
                          {e.manufacturer && <span>{e.manufacturer}</span>}
                          {e.isp_vac_s && <span>Isp {e.isp_vac_s}s (vac)</span>}
                          {e.first_flight && <span>since {e.first_flight}</span>}
                          {e.note && <span className="text-white/30 italic">{e.note}</span>}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <ClientRocketPayloads rocketId={rocket.id} initialPayloads={payloads as any} />

      <News articles={articles} />
    </div>
  );
}
