import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { api, getLaunchTitle, isUuid } from "@/lib/api";
import { PageHeader, Chip, Outcome, SectionHeader, SpecList, outcomeKey, outcomeLabel } from "@/components/ui";
import { JsonLd, breadcrumbSchema } from "@/components/JsonLd";
import { YouTubeFacade } from "@/components/YouTubeFacade";
import { youTubeId } from "@/lib/youtube";

export const runtime = "edge";

type Launch = Record<string, any>;

// Launch ids are UUIDs; anything else is a 404 without touching the database.
async function load(id: string): Promise<Launch | null> {
  return isUuid(id) ? api.launch(id) : null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const launch = await load(params.id).catch(() => undefined);
  if (launch === null) notFound();
  if (!launch) return { title: "Launch — Orbica" };
  const rocketName = launch.rocket?.name ?? "Unknown rocket";
  const title = getLaunchTitle(launch.mission_name, launch.name, rocketName);
  return {
    title: `${title} — Orbica`,
    description: `Mission details for ${title}, launched aboard ${rocketName}. Outcome: ${outcomeLabel(launch.outcome)}.`,
    alternates: { canonical: `https://orbica.space/launches/${params.id}` },
  };
}

function fmtDateTime(d?: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleString("en-US", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
  });
}

export default async function LaunchDetailPage({ params }: { params: { id: string } }) {
  const launch = await load(params.id);
  if (!launch) notFound();

  const rocket = launch.rocket as Record<string, any> | null;
  const agency = launch.agency as Record<string, any> | null;
  const site = launch.launch_site as Record<string, any> | null;
  const payloads: any[] = Array.isArray(launch.payloads) ? launch.payloads : [];
  const year = launch.launch_year as number | null;

  const cleanedTitle = getLaunchTitle(launch.mission_name, launch.name, rocket?.name);
  const isUnknown = !launch.mission_name || launch.mission_name.toLowerCase().includes("unknown payload") || launch.mission_name.toLowerCase() === "unknown";
  const videoId = youTubeId(launch.video_url);
  const key = outcomeKey(launch.outcome);

  const overview: [string, React.ReactNode][] = [
    ["Date / time", fmtDateTime(launch.launch_time)],
    ["Outcome", <Outcome key="o" outcome={launch.outcome} />],
    ["Launch site", site?.name],
    ["Mission", isUnknown ? "Classified" : launch.mission_name],
    ["Mission type", isUnknown ? "Classified" : launch.mission_type],
    ["Orbit achieved", launch.orbit_achieved],
  ];

  return (
    <div>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          ...(year ? [{ name: `${year}`, path: `/timeline/${year}` }] : [{ name: "Timeline", path: "/timeline" }]),
          { name: cleanedTitle, path: `/launches/${params.id}` },
        ])}
      />
      <PageHeader
        eyebrow={[year, agency?.name].filter(Boolean).join(" · ") || "Launch"}
        title={cleanedTitle}
        back={year ? { href: `/timeline/${year}`, label: `${year}` } : { href: "/timeline", label: "Timeline" }}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <Chip tone={key === "success" ? "success" : key === "failure" || key === "partial_failure" ? "danger" : key === "upcoming" ? "accent" : "muted"}>
              {outcomeLabel(launch.outcome)}
            </Chip>
            {!isUnknown && launch.name !== launch.mission_name && <span className="text-ink-3">{launch.name}</span>}
          </span>
        }
      />

      {launch.mission_description && (
        <p className="-mt-4 mb-10 max-w-3xl font-light leading-relaxed text-ink-2">{launch.mission_description}</p>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <SpecList title="Overview" rows={overview} />
          {launch.failure_reason && (
            <div className="mt-4 border border-danger/20 bg-danger/[0.04] p-4 text-sm text-danger/90">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-danger/70">Failure</span>
              {launch.failure_reason}
            </div>
          )}
        </div>

        {/* vehicle + provider links — the connective tissue */}
        <div className="space-y-3">
          {rocket?.slug && (
            <Link href={`/rockets/${rocket.slug}`} className="card card-link group p-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-4">Launch vehicle</span>
              <div className="mt-1 text-xl font-light transition-colors group-hover:text-accent">{rocket.name} →</div>
            </Link>
          )}
          {agency?.slug && (
            <Link href={`/agencies/${agency.slug}`} className="card card-link group p-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-4">Launch provider</span>
              <div className="mt-1 text-xl font-light transition-colors group-hover:text-accent">{agency.name} →</div>
            </Link>
          )}
          {(launch.video_url || launch.article_url) && (
            <div className="flex gap-2">
              {launch.video_url && (
                <a href={launch.video_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary flex-1">
                  Watch ↗
                </a>
              )}
              {launch.article_url && (
                <a href={launch.article_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary flex-1">
                  Article ↗
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {videoId && (
        <section className="mt-14">
          <SectionHeader title="Webcast" />
          <div className="relative mx-auto aspect-video w-full max-w-4xl overflow-hidden border border-line bg-black">
            <YouTubeFacade id={videoId} title={`${cleanedTitle} webcast`} />
          </div>
        </section>
      )}

      {/* payloads — connects to the satellites */}
      {payloads.length > 0 && (
        <section className="mt-16">
          <SectionHeader title="Payloads deployed" count={payloads.length} />
          <div className="tile-grid sm:grid-cols-2 lg:grid-cols-3">
            {payloads.map((s) => (
              <Link key={s.id} href={`/satellites/${s.slug ?? s.id}`} className="tile group p-4">
                <div className="truncate font-light transition-colors group-hover:text-accent">{s.name}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-wide text-ink-4">
                  {s.constellation ? `${s.constellation} · ` : ""}
                  {s.orbit_type ?? s.purpose ?? "payload"}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
