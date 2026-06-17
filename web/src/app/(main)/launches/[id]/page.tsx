import Link from "next/link";
import { api, getLaunchTitle } from "@/lib/api";
import { safe } from "@/components/EmptyState";
import { PageHeader, Chip, Outcome } from "@/components/ui";

export const runtime = "edge";

type Launch = Record<string, any>;

function fmtDateTime(d?: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleString("en-US", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
  });
}

function getYouTubeEmbedUrl(url?: string | null): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
}

export default async function LaunchDetailPage({ params }: { params: { id: string } }) {
  const launch = (await safe<Launch | null>(api.launch(params.id), null)) as Launch | null;
  if (!launch) {
    return <PageHeader title="Launch not found" back={{ href: "/timeline", label: "Timeline" }} />;
  }

  const rocket = launch.rocket as Record<string, any> | null;
  const agency = launch.agency as Record<string, any> | null;
  const site = launch.launch_site as Record<string, any> | null;
  const payloads: any[] = Array.isArray(launch.payloads) ? launch.payloads : [];
  const year = launch.launch_year as number | null;

  const cleanedTitle = getLaunchTitle(launch.mission_name, launch.name, rocket?.name);
  const isUnknown = !launch.mission_name || launch.mission_name.toLowerCase().includes("unknown payload") || launch.mission_name.toLowerCase() === "unknown";
  const embedUrl = getYouTubeEmbedUrl(launch.video_url);

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
      <PageHeader
        eyebrow={[year, agency?.name].filter(Boolean).join(" · ") || "Launch"}
        title={cleanedTitle}
        back={year ? { href: `/timeline/${year}`, label: `${year}` } : { href: "/timeline", label: "Timeline" }}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <Chip>{launch.outcome?.replace("_", " ") ?? "unknown"}</Chip>
            {!isUnknown && launch.name !== launch.mission_name && <span className="text-white/45">{launch.name}</span>}
          </span>
        }
      />

      {launch.mission_description && (
        <p className="-mt-6 mb-10 max-w-3xl text-white/55 font-light leading-relaxed">
          {launch.mission_description}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* overview */}
        <div>
          <h2 className="text-[11px] tracking-[0.3em] uppercase text-white/45 mb-4">Overview</h2>
          <dl className="divide-y divide-white/10 border-y border-white/10">
            {overview.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 py-3">
                <dt className="text-[13px] tracking-wide text-white/45">{k}</dt>
                <dd className="font-mono text-sm text-right">{v}</dd>
              </div>
            ))}
          </dl>
          {launch.failure_reason && (
            <div className="mt-4 border border-red-500/20 bg-red-500/[0.04] p-4 text-sm text-red-300/80">
              <span className="text-[10px] tracking-[0.2em] uppercase text-red-400/70 block mb-1">Failure</span>
              {launch.failure_reason}
            </div>
          )}
        </div>

        {/* vehicle + provider links — the connective tissue */}
        <div className="space-y-4">
          {rocket?.slug && (
            <Link
              href={`/rockets/${rocket.slug}`}
              className="block border border-white/10 bg-[#06080f] p-5 hover:border-[var(--color-space-accent-2)]/50 hover:bg-[#0c1322] transition-colors group"
            >
              <span className="text-[10px] tracking-[0.25em] uppercase text-white/40">Launch vehicle</span>
              <div className="mt-1 text-xl font-light group-hover:text-[var(--color-space-accent-2)] transition-colors">
                {rocket.name} →
              </div>
            </Link>
          )}
          {agency?.slug && (
            <Link
              href={`/agencies/${agency.slug}`}
              className="block border border-white/10 bg-[#06080f] p-5 hover:border-[var(--color-space-accent-2)]/50 hover:bg-[#0c1322] transition-colors group"
            >
              <span className="text-[10px] tracking-[0.25em] uppercase text-white/40">Launch provider</span>
              <div className="mt-1 text-xl font-light group-hover:text-[var(--color-space-accent-2)] transition-colors">
                {agency.name} →
              </div>
            </Link>
          )}
          {(launch.video_url || launch.article_url) && (
            <div className="flex gap-2">
              {launch.video_url && (
                <a href={launch.video_url} target="_blank" rel="noopener noreferrer" className="flex-1 border border-white/15 px-4 py-3 text-[11px] tracking-[0.2em] uppercase text-center text-white/70 hover:bg-white hover:text-black transition-colors">
                  Watch ↗
                </a>
              )}
              {launch.article_url && (
                <a href={launch.article_url} target="_blank" rel="noopener noreferrer" className="flex-1 border border-white/15 px-4 py-3 text-[11px] tracking-[0.2em] uppercase text-center text-white/70 hover:bg-white hover:text-black transition-colors">
                  Article ↗
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {embedUrl && (
        <section className="mt-12">
          <h2 className="text-[11px] tracking-[0.3em] uppercase text-white/45 mb-5 border-b border-white/10 pb-3">
            Webcast Broadcast
          </h2>
          <div className="aspect-video w-full border border-white/10 bg-black max-w-4xl mx-auto rounded-lg overflow-hidden">
            <iframe
              src={embedUrl}
              title="Launch Webcast"
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </section>
      )}

      {/* payloads — connects to the satellites */}
      {payloads.length > 0 && (
        <section className="mt-16">
          <h2 className="text-[11px] tracking-[0.3em] uppercase text-white/45 mb-5 border-b border-white/10 pb-3">
            Payloads deployed · {payloads.length}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5">
            {payloads.map((s) => (
              <Link
                key={s.id}
                href={`/satellites/${s.slug ?? s.id}`}
                className="group bg-[#06080f] p-4 hover:bg-[#0c1322] transition-colors"
              >
                <div className="font-light truncate group-hover:text-[var(--color-space-accent-2)] transition-colors">
                  {s.name}
                </div>
                <div className="text-[10px] text-white/40 font-mono uppercase tracking-wide mt-1">
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
