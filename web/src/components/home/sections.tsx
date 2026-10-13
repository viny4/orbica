import Link from "next/link";
import dynamic from "next/dynamic";
import { api, getLaunchTitle } from "@/lib/api";
import { safe } from "@/components/EmptyState";
import { ArrowLink, Outcome, SectionTitle, StatusDot, timeAgo } from "@/components/ui";
import { Countdown } from "@/components/Countdown";
import { LaunchHistogram } from "./LaunchHistogram";

// Server components for each landing-page section. Every one fetches its own
// data (deduplicated per request by api.ts) and degrades to nothing on failure,
// so one slow or failing source never blocks or breaks the rest of the page.

const IssMini = dynamic(() => import("./IssMini"));

const fmt = (n: number | undefined | null) => (n ?? 0).toLocaleString("en-US");

const dateFmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" })
    : "TBD";

// ── Hero live strip ──────────────────────────────────────────────────────────

export async function HeroLive() {
  const [s, sync] = await Promise.all([safe(api.stats(), null), safe(api.syncStatus(), null)]);
  if (!s) return <HeroLiveSkeleton />;
  const fresh = sync?.last_success_at ?? sync?.last_run_at ?? null;
  const ok = !sync || sync.last_run_status === "success";
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
      <span className="flex items-center gap-2 text-ink-2">
        <StatusDot tone={ok ? "success" : "warning"} pulse />
        Live catalogue
      </span>
      <span><span className="text-ink">{fmt(s.satellites)}</span> objects</span>
      <span><span className="text-ink">{fmt(s.launches)}</span> launches</span>
      {fresh && <span className="hidden sm:inline">Refreshed {timeAgo(fresh)}</span>}
    </div>
  );
}

export function HeroLiveSkeleton() {
  return <div className="h-4 w-full max-w-md animate-pulse bg-white/[0.04]" aria-hidden />;
}

// ── Stats band ───────────────────────────────────────────────────────────────

export async function StatsBand() {
  const s = await safe(api.stats(), null);
  const items: [string, number | undefined, string][] = [
    ["Satellites & objects", s?.satellites, "catalogued since Sputnik"],
    ["Launches", s?.launches, "every orbital attempt"],
    ["Launch vehicles", s?.rockets, "rockets and variants"],
    ["Agencies", s?.agencies, "operators worldwide"],
  ];
  return (
    <div className="tile-grid grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value, hint], i) => (
        <div key={label} className="tile reveal p-6 sm:p-8" style={{ ["--i" as string]: i }}>
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-ink-4">{label}</div>
          <div className={`mt-4 text-4xl font-extralight tabular-nums tracking-tight sm:text-5xl ${i === 0 ? "text-accent" : "text-ink"}`}>
            {s ? fmt(value) : "—"}
          </div>
          <div className="mt-2 text-xs text-ink-3">{hint}</div>
        </div>
      ))}
    </div>
  );
}

export function StatsBandSkeleton() {
  return <div className="h-[168px] animate-pulse border border-line bg-white/[0.015] sm:h-[188px]" aria-hidden />;
}

// ── Next launches ────────────────────────────────────────────────────────────

export async function UpcomingSection() {
  const items = await safe(api.upcoming(4), []);
  if (!items.length) {
    return <p className="border border-line p-10 text-center text-sm text-ink-3">No launches are scheduled right now.</p>;
  }
  const [next, ...rest] = items;
  return (
    <div className="grid gap-px border border-line bg-line lg:grid-cols-[1.35fr_1fr]">
      <Link href={`/launches/${next.id}`} className="tile group reveal relative overflow-hidden p-6 sm:p-10">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(125,249,255,0.12),transparent_65%)]" />
        <div className="flex items-center gap-2.5">
          <StatusDot tone="accent" pulse />
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">Next launch</span>
        </div>
        <h3 className="mt-5 text-2xl font-light uppercase leading-tight tracking-tight transition-colors group-hover:text-accent sm:text-3xl">
          {getLaunchTitle(next.mission_name, next.name, next.rocket_name)}
        </h3>
        <p className="mt-2 text-sm text-ink-3">
          {[next.rocket_name, next.agency_name].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-8">
          {next.launch_time ? <Countdown target={next.launch_time} variant="hero" /> : <span className="text-ink-3">Date TBD</span>}
        </div>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-4">{dateFmt(next.launch_time)}</p>
      </Link>
      <ul className="grid gap-px bg-line">
        {rest.map((l, i) => (
          <li key={l.id} className="reveal" style={{ ["--i" as string]: i + 1 }}>
            <Link href={`/launches/${l.id}`} className="tile group flex h-full flex-col justify-between gap-3 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-4">{dateFmt(l.launch_time)}</span>
                {l.launch_time && <Countdown target={l.launch_time} />}
              </div>
              <div>
                <div className="line-clamp-1 text-lg font-light transition-colors group-hover:text-accent">
                  {getLaunchTitle(l.mission_name, l.name, l.rocket_name)}
                </div>
                <div className="mt-1 truncate text-xs text-ink-3">{[l.rocket_name, l.agency_name].filter(Boolean).join(" · ")}</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function UpcomingSkeleton() {
  return <div className="h-[420px] animate-pulse border border-line bg-white/[0.015] lg:h-[360px]" aria-hidden />;
}

// ── Platform previews (bento) ────────────────────────────────────────────────

export async function PreviewsSection() {
  const [years, issTle, s] = await Promise.all([
    safe(api.timelineYears(), []),
    safe(api.satelliteTle("iss-zarya"), null),
    safe(api.stats(), null),
  ]);
  const thisYear = new Date().getUTCFullYear();
  const current = years.find((y) => y.launch_year === thisYear);

  return (
    <div className="grid gap-px border border-line bg-line lg:grid-cols-2">
      {/* Live tracker preview */}
      <div className="tile reveal flex flex-col p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Live tracker</p>
            <h3 className="mt-2 text-xl font-light uppercase tracking-tight">Where is the ISS right now?</h3>
          </div>
          <StatusDot tone="success" pulse />
        </div>
        <div className="mt-6 flex-1">
          {issTle?.tle_line1 && issTle.tle_line2 ? (
            <IssMini line1={issTle.tle_line1} line2={issTle.tle_line2} />
          ) : (
            <p className="text-sm text-ink-3">Live orbital data is briefly unavailable.</p>
          )}
        </div>
        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-5">
          <ArrowLink href="/iss">ISS live page</ArrowLink>
          <ArrowLink href="/track">Track every satellite</ArrowLink>
        </div>
      </div>

      {/* Archive preview */}
      <div className="tile reveal flex flex-col p-6 sm:p-8" style={{ ["--i" as string]: 1 }}>
        <p className="eyebrow">Launch archive</p>
        <h3 className="mt-2 text-xl font-light uppercase tracking-tight">Seventy years of orbit, year by year</h3>
        <div className="mt-6 flex-1">
          <LaunchHistogram years={years} />
        </div>
        <div className="mt-6 grid grid-cols-3 gap-4 border-t border-line pt-5 font-mono text-xs">
          <div>
            <div className="text-[9px] uppercase tracking-[0.22em] text-ink-4">Since 1957</div>
            <div className="mt-1 text-lg font-light text-ink">{s ? fmt(s.launches) : "—"}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.22em] text-ink-4">Flown in {thisYear}</div>
            <div className="mt-1 text-lg font-light text-accent">{current ? fmt(current.successes + current.failures) : "—"}</div>
          </div>
          <div className="flex items-end justify-end">
            <ArrowLink href="/timeline">Timeline</ArrowLink>
          </div>
        </div>
      </div>

      {/* Encyclopedia entry points */}
      <div className="tile reveal p-6 sm:p-8 lg:col-span-2" style={{ ["--i" as string]: 2 }}>
        <div className="grid gap-8 md:grid-cols-[1fr_2fr] md:items-end">
          <div>
            <p className="eyebrow">Encyclopedia</p>
            <h3 className="mt-2 text-xl font-light uppercase tracking-tight">Every vehicle, operator and payload — connected</h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-3">
              Follow a launch to the rocket that flew it, the agency behind it and every satellite it deployed.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-3">
            {[
              ["Rockets", s?.rockets, "/rockets", "Specs, engines & 3D"],
              ["Satellites", s?.satellites, "/satellites", "Orbits & missions"],
              ["Agencies", s?.agencies, "/agencies", "By nation"],
            ].map(([label, n, href, hint]) => (
              <Link key={href as string} href={href as string} className="tile group p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-2 transition-colors group-hover:text-accent">{label}</span>
                  <span aria-hidden className="text-ink-4 transition-transform duration-200 group-hover:translate-x-1">→</span>
                </div>
                <div className="mt-4 text-3xl font-extralight tabular-nums">{s ? fmt(n as number) : "—"}</div>
                <div className="mt-1 text-xs text-ink-4">{hint}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PreviewsSkeleton() {
  return <div className="h-[900px] animate-pulse border border-line bg-white/[0.015] lg:h-[620px]" aria-hidden />;
}

// ── On this day ──────────────────────────────────────────────────────────────

export async function OnThisDaySection() {
  const launches = await safe(api.onThisDay(), []);
  if (!launches.length) return null;
  const dateStr = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(new Date());
  return (
    <section className="shell py-20 sm:py-24">
      <SectionTitle eyebrow={`On this day · ${dateStr}`} title="Launched on today's date" action={{ href: "/on-this-day", label: "All anniversaries" }} />
      <div className="tile-grid sm:grid-cols-2 lg:grid-cols-3">
        {launches.slice(0, 3).map((l, i) => (
          <Link key={l.id} href={`/launches/${l.id}`} className="tile group reveal p-6" style={{ ["--i" as string]: i }}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-2xl font-extralight text-accent-blue">{l.launch_year}</span>
              <Outcome outcome={l.outcome} />
            </div>
            <div className="mt-5 line-clamp-2 text-lg font-light transition-colors group-hover:text-accent">{l.name}</div>
            <div className="mt-2 truncate font-mono text-[11px] uppercase tracking-wide text-ink-4">
              {l.rocket_name || "Unknown rocket"} · {l.agency_abbrev || l.agency_name || "Unknown agency"}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Leading agencies ─────────────────────────────────────────────────────────

export async function AgenciesSection() {
  const agencies = (await safe(api.agencies(), [])).slice().sort((a, b) => b.total_launches - a.total_launches).slice(0, 4);
  if (!agencies.length) return null;
  return (
    <section className="shell py-20 sm:py-24">
      <SectionTitle eyebrow="Global capability" title="Leading agencies" tone="muted" action={{ href: "/agencies", label: "Directory" }} />
      <div className="tile-grid sm:grid-cols-2 lg:grid-cols-4">
        {agencies.map((a, i) => (
          <Link key={a.id} href={`/agencies/${a.slug}`} className="tile group reveal relative overflow-hidden p-6" style={{ ["--i" as string]: i }}>
            {/* Decorative rank numeral, drawn as CSS generated content: it's
                deliberately near-invisible, and as real text it fails contrast
                checks while adding nothing for screen readers. */}
            <span
              aria-hidden
              data-n={`0${i + 1}`}
              className="pointer-events-none absolute right-4 top-3 font-mono text-6xl font-extralight text-white/[0.04] after:content-[attr(data-n)]"
            />
            <h3 className="mt-6 text-2xl font-light text-ink-2 transition-colors group-hover:text-ink">{a.abbrev || a.name}</h3>
            <span className="block truncate font-mono text-[10px] uppercase tracking-widest text-ink-4">{a.name}</span>
            <div className="mt-8 text-3xl font-light tabular-nums text-accent">{fmt(a.total_launches)}</div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-4">Total launches</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Recent anomalies ─────────────────────────────────────────────────────────

export async function AnomaliesSection() {
  const items = await safe(api.failures(3, 0), []);
  if (!items.length) return null;
  return (
    <section className="shell py-20 sm:py-24">
      <SectionTitle eyebrow="Mission critical" title="Recent anomalies" tone="danger" action={{ href: "/failures", label: "Failure archive" }} />
      <div className="grid gap-px border border-danger/15 bg-danger/10 md:grid-cols-3">
        {items.map((l, i) => (
          <Link key={l.id} href={`/launches/${l.id}`} className="group reveal block bg-surface p-6 transition-colors hover:bg-[#140a0d]" style={{ ["--i" as string]: i }}>
            <div className="flex items-center justify-between gap-3">
              <span className="border border-danger/30 bg-danger/10 px-2 py-1"><Outcome outcome={l.outcome} /></span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-4">{l.launch_year ?? ""}</span>
            </div>
            <h3 className="mt-5 line-clamp-2 text-lg font-light transition-colors group-hover:text-danger">{l.name}</h3>
            <div className="mt-3 text-xs text-ink-3">{l.rocket_name}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-4">{l.agency_name}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
