import Link from "next/link";
import dynamic from "next/dynamic";
import { safe } from "@/components/EmptyState";

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
      <section className="border-y border-white/10 bg-[#06080e] relative z-20">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-10 grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5">
          {[
            [fmt(s?.satellites), "Satellites tracked", "text-[var(--color-space-accent-2)]"],
            [fmt(s?.launches), "Launches catalogued", "text-white"],
            [fmt(s?.rockets), "Launch vehicles", "text-white"],
            [fmt(s?.agencies), "Space agencies", "text-[var(--color-space-accent)]"],
          ].map(([num, label, color], i) => (
            <div key={i} className="px-6 sm:px-8 py-10 flex flex-col justify-center">
              <span className={`text-3xl sm:text-4xl lg:text-5xl font-extralight tracking-tight ${color}`}>
                {num}
              </span>
              <span className="mt-2 text-[10px] tracking-[0.22em] uppercase text-white/40 font-mono">
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────────── FEATURE SECTIONS ───────────────────── */}
      <section className="relative py-20 border-b border-white/10">
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
      <footer className="border-t border-white/10 bg-black/40 py-10 text-center relative z-20">
        <p className="text-[10px] tracking-[0.3em] uppercase text-white/30 font-mono">
          ORBICA SYSTEM &copy; 2026 &middot; TRANSMITTING NOMINAL DATA
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
