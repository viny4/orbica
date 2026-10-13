export const runtime = "edge";

import Link from "next/link";
import type { Metadata } from "next";
import { api, getLaunchTitle } from "@/lib/api";
import { safe } from "@/components/EmptyState";
import { PageHeader, SectionHeader, StatusDot } from "@/components/ui";
import { Countdown } from "@/components/Countdown";

export const metadata: Metadata = {
  title: "Upcoming Launches — Live Countdowns — Orbica",
  description: "Every scheduled orbital launch worldwide with live countdowns, vehicles, operators and launch sites.",
};

// Server-rendered manifest (indexable, paints without JS) with live countdowns
// hydrated on top — all of them ticking off one shared clock.

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString("en-US", { timeZone: "UTC", ...opts });

export default async function UpcomingPage() {
  const items = await safe(api.upcoming(40), null);
  const [next, ...rest] = items ?? [];

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Orbital schedule & launch manifest"
        title="Upcoming Missions"
        meta="Scheduled orbital flights worldwide. Times in UTC; schedules slip often, so countdowns follow the latest published date."
      />

      {items === null ? (
        <p className="border border-line p-10 text-center text-sm text-ink-3">The launch schedule is unavailable right now — please try again shortly.</p>
      ) : !next ? (
        <p className="border border-line p-10 text-center text-sm text-ink-3">No launches are scheduled right now.</p>
      ) : (
        <>
          {/* ── Spotlight ── */}
          <section className="relative overflow-hidden border border-accent/30 bg-gradient-to-br from-white/[0.02] via-transparent to-accent/[0.02]">
            <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(125,249,255,0.14),transparent_65%)]" />
            <div className="relative flex flex-col gap-8 p-6 sm:p-10 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl space-y-4">
                <div className="flex items-center gap-2.5">
                  <StatusDot tone="accent" pulse />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-accent">Next launch</span>
                </div>
                <Link href={`/launches/${next.id}`} className="block text-2xl font-light uppercase transition-colors hover:text-accent sm:text-3xl">
                  {getLaunchTitle(next.mission_name, next.name, next.rocket_name)}
                </Link>
                {next.mission_description && <p className="line-clamp-3 text-sm font-light leading-relaxed text-ink-3">{next.mission_description}</p>}
                <dl className="grid grid-cols-2 gap-4 pt-2 font-mono text-[11px]">
                  {[
                    ["Vehicle", next.rocket_name],
                    ["Operator", next.agency_name],
                    ["Launch site", next.site_name],
                    ["UTC target", next.launch_time ? fmt(next.launch_time, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "TBD"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[9px] uppercase text-ink-4">{k}</dt>
                      <dd className="mt-0.5 text-ink">{v || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="flex w-full shrink-0 flex-col items-center gap-6 border-t border-line pt-6 md:w-auto md:items-end md:border-l md:border-t-0 md:pl-10 md:pt-0">
                {next.launch_time && <Countdown target={next.launch_time} variant="hero" />}
                <Link href={`/launches/${next.id}`} className="btn btn-primary w-full md:w-auto">
                  Mission details →
                </Link>
              </div>
            </div>
          </section>

          {/* ── Manifest ── */}
          <section>
            <SectionHeader title="Upcoming manifest" count={rest.length} />
            <div className="tile-grid md:grid-cols-2">
              {rest.map((l) => (
                <article key={l.id} className="tile group flex flex-col justify-between p-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="border border-line px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ink-3">
                        {l.mission_type || "Spaceflight"}
                      </span>
                      {l.launch_time && <Countdown target={l.launch_time} />}
                    </div>
                    <Link href={`/launches/${l.id}`} className="block truncate text-base font-light uppercase transition-colors hover:text-accent">
                      {getLaunchTitle(l.mission_name, l.name, l.rocket_name)}
                    </Link>
                    <dl className="space-y-0.5 font-mono text-[11px] text-ink-3">
                      <div>Vehicle: <span className="text-ink-2">{l.rocket_name || "—"}</span></div>
                      <div>Agency: <span className="text-ink-2">{l.agency_name || "—"}</span></div>
                      <div className="truncate">Pad: <span className="text-ink-2">{l.site_name || "—"}</span></div>
                    </dl>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-line pt-3 font-mono text-[10px]">
                    <span className="text-ink-4">
                      {l.launch_time ? fmt(l.launch_time, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }) : "TBD"}
                    </span>
                    <Link href={`/launches/${l.id}`} className="text-accent/80 transition-colors hover:text-accent">
                      Details →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
