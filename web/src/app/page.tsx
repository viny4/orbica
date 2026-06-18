import Link from "next/link";
import dynamic from "next/dynamic";
import { safe } from "@/components/EmptyState";
import { api } from "@/lib/api";
import { OnThisDay } from "@/components/timeline/OnThisDay";

const Hero3D = dynamic(() => import("@/components/home/Hero3D"), { ssr: false });

interface Overview {
  satellites: number;
  rockets: number;
  agencies: number;
  launches: number;
  launch_sites: number;
  years: number;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8090";

async function getStats(): Promise<Overview | null> {
  return safe(
    fetch(`${API}/api/v1/stats/overview`, { next: { revalidate: 120 } }).then((r) =>
      r.ok ? r.json() : null
    ),
    null
  );
}

interface SyncLog {
  id: string;
  timestamp: string;
  job_name: string;
  status: string;
}

async function getLastSync(): Promise<SyncLog | null> {
  return safe(
    fetch(`${API}/api/v1/sync-logs?limit=1`, { next: { revalidate: 10 } }).then((r) =>
      r.ok ? r.json().then((d) => (d && d.length ? d[0] : null)) : null
    ),
    null
  );
}

const fmt = (n: number | undefined) => (n ?? 0).toLocaleString("en-US");

export default async function Home() {
  const s = await getStats();
  const lastSync = await getLastSync();
  const onThisDayLaunches = await safe(api.onThisDay(), []);
  const upcomingLaunches = await safe(api.upcoming(3), []);
  const topAgencies = (await safe(api.agencies(), [])).sort((a, b) => b.total_launches - a.total_launches).slice(0, 4);
  const recentAnomalies = await safe(api.failures(3, 0), []);

  return (
    <div className="bg-[#03050a] text-white min-h-screen">
      {/* ───────────────────── HERO SECTION ───────────────────── */}
      <section className="relative h-screen w-full overflow-hidden">
        <Hero3D />
        
        {/* Dynamic Vignettes for deep space look */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#03050a] via-[#03050a]/30 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#03050a] via-transparent to-[#03050a]/40" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(91,140,255,0.06),transparent_40%)]" />

        <div className="relative z-10 h-full mx-auto max-w-[1400px] px-6 lg:px-10 flex flex-col justify-center">
          <div className="animate-fade-in space-y-6">
            <p className="text-[10px] tracking-[0.45em] uppercase text-[var(--color-space-accent-2)] font-mono">
              EST. 1957 — ORBITAL RECORD SYSTEM
            </p>
            <h1 className="font-extralight uppercase leading-[0.92] tracking-tighter text-[11vw] sm:text-[8vw] lg:text-[6.5rem] max-w-4xl">
              Every Rocket.<br />
              <span className="font-light text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-[var(--color-space-accent-2)]">
                Every Satellite.
              </span>
            </h1>
            <p className="max-w-xl text-sm sm:text-base text-white/50 leading-relaxed font-light">
              Orbica is the complete record of human space activity. Browse 70 years of orbital history, 
              inspect interactive 3D launch vehicles, and track thousands of active satellites moving live in the sky.
            </p>
            
            <div className="pt-6 flex flex-wrap gap-4">
              <Link
                href="/timeline"
                className="px-8 py-3.5 text-[10px] tracking-[0.25em] uppercase bg-white text-black font-semibold hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Explore Archive
              </Link>
              <Link
                href="/track"
                className="px-8 py-3.5 text-[10px] tracking-[0.25em] uppercase border border-white/20 text-white font-mono hover:bg-white/[0.04] hover:border-white/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Launch Tracker
              </Link>
            </div>
          </div>
        </div>

        {/* Floating Telemetry Status Widget */}
        {lastSync && (
          <div
            className="absolute bottom-20 left-6 lg:left-10 z-20 hidden sm:flex items-center gap-3 bg-black/60 backdrop-blur border border-white/10 p-3 text-[10px] font-mono tracking-wider text-white/60"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${lastSync.status === "success" ? "bg-emerald-400 animate-pulse" : "bg-red-500 animate-ping"}`} />
            <div>
              <div className="text-white/40 uppercase text-[9px]">Pipeline Telemetry</div>
              <div className="text-white">Last Sync: {lastSync.status === "success" ? "Success" : "Failed"}</div>
            </div>
          </div>
        )}

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[9px] tracking-[0.35em] uppercase text-white/30 font-mono animate-bounce">
          Scroll down
        </div>
      </section>

      {/* ───────────────────── STATS DASHBOARD ───────────────────── */}
      <section className="border-y border-white/10 bg-[#06080e] relative z-20 overflow-hidden py-5 flex">
        <div className="flex animate-marquee whitespace-nowrap">
          {/* Duplicate content twice to create a seamless scrolling loop */}
          {[...Array(2)].map((_, loopIdx) => (
            <div key={loopIdx} className="flex items-center shrink-0 pr-16 gap-16">
              {[
                [fmt(s?.satellites), "Satellites tracked", "text-[var(--color-space-accent-2)]"],
                [fmt(s?.launches), "Launches catalogued", "text-white"],
                [fmt(s?.rockets), "Launch vehicles", "text-white"],
                [fmt(s?.agencies), "Space agencies", "text-[var(--color-space-accent)]"],
              ].map(([num, label, color], i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className={`text-xl font-mono tracking-tight ${color}`}>
                    {num}
                  </span>
                  <span className="text-[10px] tracking-[0.2em] uppercase text-white/40 font-mono">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────────── ON THIS DAY WIDGET ───────────────────── */}
      {onThisDayLaunches && onThisDayLaunches.length > 0 && (
        <section className="relative py-10 border-b border-white/10 bg-[#06080f]/50">
          <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
             <OnThisDay launches={onThisDayLaunches} />
          </div>
        </section>
      )}

      {/* ───────────────────── UPCOMING LAUNCHES ───────────────────── */}
      <section className="relative py-24 border-b border-white/10">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
          <div className="flex justify-between items-end mb-10 border-b border-white/10 pb-4">
            <div>
              <span className="text-[10px] tracking-[0.3em] uppercase text-[var(--color-space-accent-2)] font-mono">Live Countdowns</span>
              <h2 className="text-3xl uppercase font-light tracking-tight mt-2">Upcoming Missions</h2>
            </div>
            <Link href="/upcoming" className="text-[10px] tracking-[0.2em] uppercase text-white/50 hover:text-white transition-colors font-mono">
              View All →
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {upcomingLaunches.map((l: any) => (
              <Link key={l.id} href={`/launches/${l.id}`} className="group relative block border border-white/10 bg-white/[0.015] p-6 transition-colors duration-300 hover:border-[var(--color-space-accent-2)]/50 hover:bg-white/[0.03]">
                <div className="flex flex-col h-full">
                  <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-mono mb-4 block">
                    {new Date(l.launch_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <h3 className="text-xl font-light mb-2 group-hover:text-[var(--color-space-accent-2)] transition-colors line-clamp-2">
                    {l.name}
                  </h3>
                  <div className="mt-auto pt-4 flex flex-col gap-1">
                    <span className="text-xs text-white/50">{l.rocket_name}</span>
                    <span className="text-[10px] tracking-wider uppercase font-mono text-white/30">{l.agency_name}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────── TOP AGENCIES ───────────────────── */}
      <section className="relative py-24 border-b border-white/10 bg-[#06080e]/30">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
          <div className="flex justify-between items-end mb-10 border-b border-white/10 pb-4">
            <div>
              <span className="text-[10px] tracking-[0.3em] uppercase text-white/40 font-mono">Global Capabilities</span>
              <h2 className="text-3xl uppercase font-light tracking-tight mt-2">Leading Agencies</h2>
            </div>
            <Link href="/agencies" className="text-[10px] tracking-[0.2em] uppercase text-white/50 hover:text-white transition-colors font-mono">
              Directory →
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {topAgencies.map((agency: any, idx: number) => (
              <Link key={agency.id} href={`/agencies/${agency.id}`} className="group relative block border border-white/10 bg-white/[0.015] p-6 transition-colors duration-300 hover:border-white/30 hover:bg-white/[0.03]">
                <div className="flex flex-col h-full">
                  <div className="text-[4rem] font-extralight text-white/5 leading-none absolute top-4 right-4 pointer-events-none">
                    0{idx + 1}
                  </div>
                  <h3 className="text-2xl font-light mb-1 mt-6 group-hover:text-white text-white/80 transition-colors">
                    {agency.abbrev || agency.name}
                  </h3>
                  <span className="text-[10px] uppercase tracking-widest font-mono text-white/30 truncate max-w-full block">
                    {agency.name}
                  </span>
                  <div className="mt-8">
                    <div className="text-3xl font-light text-[var(--color-space-accent-2)]">{fmt(agency.total_launches)}</div>
                    <div className="text-[9px] uppercase tracking-[0.2em] font-mono text-white/40 mt-1">Total Launches</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────── RECENT ANOMALIES ───────────────────── */}
      <section className="relative py-24 border-b border-white/10">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
          <div className="flex justify-between items-end mb-10 border-b border-white/10 pb-4">
            <div>
              <span className="text-[10px] tracking-[0.3em] uppercase text-red-500/70 font-mono">Mission Critical</span>
              <h2 className="text-3xl uppercase font-light tracking-tight mt-2">Recent Anomalies</h2>
            </div>
            <Link href="/failures" className="text-[10px] tracking-[0.2em] uppercase text-white/50 hover:text-white transition-colors font-mono">
              Failure Archive →
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recentAnomalies.map((l: any) => (
              <Link key={l.id} href={`/launches/${l.id}`} className="group relative block border border-red-900/30 bg-red-950/10 p-6 transition-colors duration-300 hover:border-red-500/40 hover:bg-red-900/20">
                <div className="flex flex-col h-full">
                  <span className="text-[10px] uppercase tracking-wider text-red-400 font-mono mb-4 block border border-red-500/30 px-2 py-1 w-max bg-red-500/10">
                    {l.outcome}
                  </span>
                  <h3 className="text-xl font-light mb-2 group-hover:text-red-300 text-white transition-colors">
                    {l.name}
                  </h3>
                  <div className="mt-auto pt-4 flex flex-col gap-1">
                    <span className="text-xs text-white/50">{l.rocket_name}</span>
                    <span className="text-[10px] tracking-wider uppercase font-mono text-white/30">{l.agency_name}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────── FEATURE SECTIONS ───────────────────── */}
      <section className="relative py-32 border-b border-white/10 bg-[#06080e]/50">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
          <div className="text-center max-w-xl mx-auto mb-16 space-y-4">
            <span className="text-[10px] tracking-[0.3em] uppercase text-[var(--color-space-accent-2)] font-mono">System Core Modules</span>
            <h2 className="text-3xl uppercase font-light tracking-tight">System Capabilities</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              num="01"
              title="Interactive Timeline"
              description="Explore 70 years of orbital launches from 1957. Every mission outcome, payload type, and booster is fully catalogued and cross-referenced."
              href="/timeline"
              cta="Open Archive"
            />
            <FeatureCard
              num="02"
              title="Launch Vehicles in 3D"
              description="Visualize the specs, stages, height, and structures of launch vehicles dynamically in 3D. Inspect materials, engines, and historical flights."
              href="/rockets"
              cta="Explore Rockets"
            />
            <FeatureCard
              num="03"
              title="Live Satellite Tracker"
              description="Track thousands of active satellites in real time. Use browser geolocation to detect nearby nodes overhead, inspect orbits, and compute telemetry."
              href="/track"
              cta="Launch Tracker"
            />
          </div>
        </div>
      </section>

      {/* ───────────────────── FOOTER ───────────────────── */}
      <footer className="border-t border-white/10 bg-black py-12 text-center relative z-20">
        <p className="text-[10px] tracking-[0.3em] uppercase text-white/30 font-mono">
          ORBICA SYSTEM &copy; {new Date().getFullYear()} &middot; TRANSMITTING NOMINAL DATA
        </p>
      </footer>
    </div>
  );
}

function FeatureCard({
  num,
  title,
  description,
  href,
  cta,
}: {
  num: string;
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="border border-white/10 bg-white/[0.01] p-6 hover:border-[var(--color-space-accent-2)]/30 hover:bg-white/[0.02] transition-all group flex flex-col justify-between min-h-[260px]">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-white/30">{num}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-space-accent-2)]/70 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <h3 className="text-lg uppercase font-light tracking-wide mt-4 text-white group-hover:text-[var(--color-space-accent-2)] transition-colors">
          {title}
        </h3>
        <p className="text-xs text-white/50 mt-3 leading-relaxed font-light">
          {description}
        </p>
      </div>
      <Link
        href={href}
        className="text-[10px] tracking-[0.2em] uppercase text-white/60 hover:text-white mt-6 flex items-center gap-1.5 transition-colors font-mono"
      >
        {cta} <span className="group-hover:translate-x-1.5 transition-transform">→</span>
      </Link>
    </div>
  );
}
