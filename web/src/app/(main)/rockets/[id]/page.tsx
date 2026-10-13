import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { api } from "@/lib/api";
import { JsonLd, breadcrumbSchema } from "@/components/JsonLd";
import { safe } from "@/components/EmptyState";
import { PageHeader, Chip, SectionHeader, SpecList } from "@/components/ui";
import { News } from "@/components/News";
import { ClientRocketPayloads } from "@/components/rockets/ClientRocketPayloads";
import RocketVisual from "@/components/rockets/RocketVisual";

export const runtime = "edge";

type Rocket = Record<string, any>;

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  // null → doesn't exist: 404 before streaming begins (real status code).
  const rocket = await api.rocket(params.id).catch(() => undefined);
  if (rocket === null) notFound();
  if (!rocket) return { title: "Rocket — Orbica" };
  const family = rocket.family?.name ? `${rocket.family.name} family` : "";
  const manufacturer = rocket.manufacturer?.name || "";
  const desc = [manufacturer, family, rocket.status ? `Status: ${rocket.status}` : ""].filter(Boolean).join(" · ");
  return {
    title: `${rocket.name} — Orbica`,
    description: `Details and specifications for the ${rocket.name} launch vehicle. ${desc}`,
    alternates: { canonical: `https://orbica.space/rockets/${rocket.slug || params.id}` },
  };
}

const num = (v: unknown) => Number(v).toLocaleString("en-US");

// Group engines by stage for the propulsion breakdown.
const STAGE_LABEL: Record<number, string> = {
  0: "Boosters",
  1: "First stage",
  2: "Second stage",
  3: "Third stage",
};

export default async function RocketDetailPage({ params }: { params: { id: string } }) {
  const [rocket, articles, payloads] = await Promise.all([
    api.rocket(params.id) as Promise<Rocket | null>,
    safe(api.rocketArticles(params.id), []),
    safe(api.rocketPayloads(params.id), []),
  ]);
  if (!rocket) notFound();

  const total = Number(rocket.total_launches ?? 0);
  const successes = Number(rocket.successful_launches ?? 0);
  const failures = Number(rocket.failed_launches ?? 0);
  const rate = total > 0 ? `${((successes / total) * 100).toFixed(1)}%` : null;

  const specs: [string, React.ReactNode][] = [
    ["Status", rocket.status],
    ["Height", rocket.height_m && `${rocket.height_m} m`],
    ["Diameter", rocket.diameter_m && `${rocket.diameter_m} m`],
    ["Mass", rocket.mass_kg && `${num(rocket.mass_kg)} kg`],
    ["Stages", rocket.stages],
    ["Thrust", rocket.thrust_kn && `${num(rocket.thrust_kn)} kN`],
    ["Payload to LEO", rocket.payload_leo_kg && `${num(rocket.payload_leo_kg)} kg`],
    ["Payload to GTO", rocket.payload_gto_kg && `${num(rocket.payload_gto_kg)} kg`],
    ["First flight", rocket.first_flight],
    ["Last flight", rocket.last_flight],
    ["Launches", total ? `${num(total)} (${successes} ✓ · ${failures} ✕)` : null],
    ["Success rate", rate],
  ];

  const family = rocket.family?.name as string | undefined;
  const manufacturer = rocket.manufacturer?.name as string | undefined;
  const manufacturerSlug = rocket.manufacturer?.slug as string | undefined;

  const eyebrowContent = (
    <span className="flex items-center gap-1.5">
      {family ? <span>{family}</span> : null}
      {family && manufacturer ? <span className="text-ink-4">·</span> : null}
      {manufacturer ? (
        manufacturerSlug ? (
          <Link href={`/agencies/${manufacturerSlug}`} className="transition-colors hover:text-ink">
            {manufacturer}
          </Link>
        ) : (
          <span>{manufacturer}</span>
        )
      ) : null}
      {!family && !manufacturer && <span>Launch Vehicle</span>}
    </span>
  );

  const engines = (rocket.engines ?? []) as Record<string, any>[];
  const stages = [...new Set(engines.map((e) => e.stage as number))].sort((a, b) => a - b);
  const thrustOf = (e: Record<string, any>) => e.thrust_sl_kn ?? e.thrust_vac_kn;
  const credit = [rocket.image_credit, rocket.image_license_name].filter(Boolean).join(" · ") || null;

  return (
    <div>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Rockets", path: "/rockets" },
          { name: String(rocket.name), path: `/rockets/${rocket.slug || params.id}` },
        ])}
      />
      <PageHeader
        eyebrow={eyebrowContent}
        title={String(rocket.name)}
        back={{ href: "/rockets", label: "Rockets" }}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <Chip tone={rocket.status === "active" ? "success" : "muted"}>{rocket.status ?? "unknown"}</Chip>
            {rocket.reusable && <Chip tone="accent">Reusable</Chip>}
          </span>
        }
        actions={
          <Link href={`/compare?r=${encodeURIComponent(rocket.slug || params.id)}`} className="btn btn-secondary">
            Compare
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <RocketVisual
          imageUrl={rocket.image_url}
          credit={credit}
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
        <SpecList title="Specifications" rows={specs} />
      </div>

      {rocket.description && (
        <p className="mt-10 max-w-3xl font-light leading-relaxed text-ink-2">{String(rocket.description)}</p>
      )}

      {engines.length > 0 && (
        <section className="mt-16">
          <SectionHeader title="Propulsion" />
          <div className="space-y-8">
            {stages.map((st) => (
              <div key={st}>
                <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.25em] text-accent/80">
                  {STAGE_LABEL[st] ?? `Stage ${st}`}
                </h3>
                <div className="tile-grid md:grid-cols-2">
                  {engines
                    .filter((e) => e.stage === st)
                    .map((e, i) => (
                      <div key={i} className="tile p-4">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-light">
                            {e.engine_count > 1 && <span className="mr-1.5 font-mono text-accent">{e.engine_count}×</span>}
                            {e.name}
                          </span>
                          {thrustOf(e) && <span className="shrink-0 font-mono text-xs text-ink-3">{num(thrustOf(e))} kN</span>}
                        </div>
                        <div className="mt-1.5 font-mono text-[11px] uppercase tracking-wide text-ink-4">
                          {[e.propellant, e.cycle].filter(Boolean).join(" · ")}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-4">
                          {e.manufacturer && <span>{e.manufacturer}</span>}
                          {e.isp_vac_s && <span>Isp {e.isp_vac_s}s (vac)</span>}
                          {e.first_flight && <span>since {e.first_flight}</span>}
                          {e.note && <span className="italic text-ink-4">{e.note}</span>}
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
