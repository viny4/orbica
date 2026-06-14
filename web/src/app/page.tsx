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
      r.ok ? r.json() : null,
    ),
    null,
  );
}

const fmt = (n: number | undefined) => (n ?? 0).toLocaleString("en-US");

function Cta({ href, label, solid = false }: { href: string; label: string; solid?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-block px-9 py-3.5 text-[11px] tracking-[0.28em] uppercase transition-colors duration-300 ${
        solid
          ? "bg-white text-black hover:bg-white/85"
          : "border border-white/70 text-white hover:bg-white hover:text-black"
      }`}
    >
      {label}
    </Link>
  );
}

export default async function Home() {
  const s = await getStats();

  return (
    <div className="bg-[#04060d] text-white">
      {/* ───────────────────── HERO ───────────────────── */}
      <section className="relative h-screen w-full overflow-hidden">
        <Hero3D />
        {/* cinematic vignettes for legibility */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#04060d] via-[#04060d]/30 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#04060d] via-transparent to-[#04060d]/40" />

        <div className="relative z-10 h-full mx-auto max-w-[1400px] px-6 lg:px-10 flex flex-col justify-center">
          <p className="text-[11px] tracking-[0.4em] uppercase text-white/55 mb-6">
            Est. 1957 — Present
          </p>
          <h1 className="font-light uppercase leading-[0.92] tracking-tight text-[13vw] sm:text-[9vw] lg:text-[6.5rem] max-w-4xl">
            Every Rocket.
            <br />
            Every Satellite.
          </h1>
          <p className="mt-8 max-w-xl text-base sm:text-lg text-white/65 leading-relaxed font-light">
            The complete record of humanity in orbit — every launch vehicle, every spacecraft,
            from Sputnik to today. Explore in interactive 3D and track the live sky in real time.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Cta href="/timeline" label="Explore the Archive" solid />
            <Cta href="/track" label="Live Tracker" />
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.3em] uppercase text-white/40">
          Scroll
        </div>
      </section>

      {/* ───────────────────── STATS ───────────────────── */}
      <section className="border-y border-white/10 bg-[#06080f]">
        <div className="mx-auto max-w-[1400px] px-6 lg:px-10 grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
          {[
            [fmt(s?.satellites), "Satellites tracked"],
            [fmt(s?.launches), "Launches recorded"],
            [fmt(s?.rockets), "Launch vehicles"],
            [fmt(s?.agencies), "Agencies & operators"],
          ].map(([num, label], i) => (
            <div key={i} className="px-4 sm:px-8 py-12 text-center">
              <div className="text-4xl sm:text-5xl font-light tabular-nums tracking-tight">{num}</div>
              <div className="mt-3 text-[10px] sm:text-[11px] tracking-[0.25em] uppercase text-white/45">
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────────── FEATURE PANELS ───────────────────── */}
      <Panel
        eyebrow="01 — The Archive"
        title="Seventy years of spaceflight"
        body="Browse year by year from 1957, or dive into any agency, rocket, or spacecraft. Every entry is cross-linked — from a vehicle to the satellites it lofted, to their live orbits today."
        cta={{ href: "/timeline", label: "Open the Timeline" }}
        watermark="1957"
        align="left"
      />
      <Panel
        eyebrow="02 — The Fleet"
        title="Every vehicle, in 3D"
        body="More than five hundred launch vehicles, each rendered as an interactive 3D model generated from its real dimensions and stage configuration. Rotate, zoom, inspect."
        cta={{ href: "/rockets", label: "Explore Rockets" }}
        watermark="3D"
        align="right"
      />
      <Panel
        eyebrow="03 — The Live Sky"
        title="Track the constellation"
        body="Thousands of active satellites, propagated in real time with SGP4 and rendered on a 3D globe. Watch the ISS, Starlink, GPS — the whole orbital population — move live."
        cta={{ href: "/track", label: "Launch the Tracker" }}
        watermark="LIVE"
        align="left"
      />

      <footer className="border-t border-white/10 py-12 text-center">
        <p className="text-[11px] tracking-[0.3em] uppercase text-white/40">
          Orbica — Every rocket, every satellite, 1957 to today
        </p>
      </footer>
    </div>
  );
}

function Panel({
  eyebrow,
  title,
  body,
  cta,
  watermark,
  align,
}: {
  eyebrow: string;
  title: string;
  body: string;
  cta: { href: string; label: string };
  watermark: string;
  align: "left" | "right";
}) {
  return (
    <section className="relative min-h-[88vh] flex items-center overflow-hidden border-b border-white/10">
      {/* giant faint watermark */}
      <div
        className={`pointer-events-none absolute inset-y-0 ${
          align === "left" ? "right-0" : "left-0"
        } flex items-center`}
      >
        <span className="font-light uppercase text-white/[0.03] text-[28vw] leading-none tracking-tighter select-none">
          {watermark}
        </span>
      </div>

      <div className="relative z-10 mx-auto max-w-[1400px] w-full px-6 lg:px-10">
        <div className={`max-w-2xl ${align === "right" ? "ml-auto text-right" : ""}`}>
          <p className="text-[11px] tracking-[0.35em] uppercase text-[var(--color-space-accent-2)]/80 mb-6">
            {eyebrow}
          </p>
          <h2 className="font-light uppercase leading-[0.95] tracking-tight text-5xl sm:text-6xl lg:text-7xl">
            {title}
          </h2>
          <p className="mt-8 text-base sm:text-lg text-white/60 leading-relaxed font-light">
            {body}
          </p>
          <div className={`mt-10 flex ${align === "right" ? "justify-end" : ""}`}>
            <Cta href={cta.href} label={cta.label} />
          </div>
        </div>
      </div>
    </section>
  );
}
