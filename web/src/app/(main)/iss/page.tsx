// "Where is the ISS right now?" — a dedicated landing page for one of the most
// common space searches. Live position from the newest TLE, the 3D orbit view,
// visible-pass predictions, and indexable FAQ copy (mirrored in FAQPage JSON-LD).

import Link from "next/link";
import dynamic from "next/dynamic";
import type { Metadata } from "next";
import { api } from "@/lib/api";
import { safe } from "@/components/EmptyState";
import { JsonLd, breadcrumbSchema, faqSchema } from "@/components/JsonLd";

export const runtime = "edge";

const ISS_SLUG = "iss-zarya"; // NORAD 25544

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export const metadata: Metadata = {
  title: "Where is the ISS right now? Live Space Station Tracker — Orbica",
  description:
    "Track the International Space Station live: current position, altitude and speed updated every second, a 3D orbit view, and when the ISS will fly over your location.",
  alternates: { canonical: "https://orbica.space/iss" },
  openGraph: {
    title: "Where is the ISS right now? — Live Tracker",
    description:
      "The International Space Station's position, updated every second, with visible pass predictions for your location.",
    url: "https://orbica.space/iss",
  },
};

const IssLiveStats = dynamic(() => import("@/components/iss/IssLiveStats"), { ssr: false });
const SatelliteVisual = dynamic(() => import("@/components/satellites/SatelliteVisual"), {
  ssr: false,
  loading: () => (
    <div className="w-full aspect-square border border-white/10 bg-black grid place-items-center text-white/40 text-sm">
      Loading…
    </div>
  ),
});
const PassPredictions = dynamic(
  () => import("@/components/satellites/PassPredictions").then((m) => m.PassPredictions),
  { ssr: false },
);

// Visible copy AND the FAQPage JSON-LD are built from this one list, so the
// structured data always matches the page (a Google requirement).
const FAQ = [
  {
    q: "How fast does the ISS travel?",
    a: "The International Space Station orbits Earth at about 27,600 km/h (17,150 mph) — roughly 7.66 km every second. At that speed it circles the planet once every ~92 minutes, seeing 16 sunrises and sunsets a day.",
  },
  {
    q: "How high is the ISS above Earth?",
    a: "The ISS flies in low Earth orbit at an altitude of roughly 400 km (250 miles). Atmospheric drag slowly lowers it, so visiting spacecraft periodically boost the station back up.",
  },
  {
    q: "Can I see the ISS with the naked eye?",
    a: "Yes — the ISS is one of the brightest objects in the night sky. It looks like a fast, steady white star crossing the sky in a few minutes, typically just after sunset or before sunrise. Use the pass predictions on this page to see when it will fly over your location.",
  },
  {
    q: "How big is the ISS?",
    a: "About 109 metres end to end — roughly the size of a football field — with a mass of around 420 tonnes. It has been continuously inhabited by rotating crews since November 2000.",
  },
];

export default async function IssPage() {
  const [sat, tle] = await Promise.all([
    safe<Record<string, any> | null>(api.satellite(ISS_SLUG), null),
    safe<{ tle_line1?: string; tle_line2?: string } | null>(
      fetch(`${API}/api/v1/satellites/${ISS_SLUG}/tle`, { next: { revalidate: 3600 } }).then((r) =>
        r.ok ? r.json() : null,
      ),
      null,
    ),
  ]);

  const l1 = tle?.tle_line1;
  const l2 = tle?.tle_line2;
  const hasTle = Boolean(l1 && l2);

  return (
    <div>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "ISS Live Tracker", path: "/iss" },
        ])}
      />
      <JsonLd data={faqSchema(FAQ)} />

      <header className="mb-10">
        <p className="text-[11px] tracking-[0.3em] uppercase text-white/45 mb-4">
          International Space Station · NORAD 25544
        </p>
        <h1 className="text-4xl md:text-6xl font-light tracking-tight">
          Where is the ISS right now?
        </h1>
        <p className="mt-4 max-w-2xl text-white/60">
          The station below is moving at ~7.66 km per second. Its position updates every second
          from the latest orbital data.
        </p>
      </header>

      {hasTle ? (
        <div className="mb-12">
          <IssLiveStats line1={l1!} line2={l2!} />
        </div>
      ) : (
        <p className="mb-12 text-white/40 text-sm">
          Live orbital data is briefly unavailable — try refreshing in a minute.
        </p>
      )}

      <div className="grid lg:grid-cols-2 gap-8 mb-16">
        <div>
          <h2 className="text-[11px] tracking-[0.25em] uppercase text-white/50 mb-4">
            Orbit view
          </h2>
          <SatelliteVisual
            name={String(sat?.name ?? "ISS (ZARYA)")}
            line1={l1}
            line2={l2}
            imageUrl={(sat?.image_url as string) ?? null}
            purpose={(sat?.purpose as string) ?? null}
            orbitType={(sat?.orbit_type as string) ?? null}
          />
        </div>
        <div>
          <h2 className="text-[11px] tracking-[0.25em] uppercase text-white/50 mb-4">
            When can I see it from my location?
          </h2>
          <div className="border border-white/10 bg-white/[0.02] p-6">
            <p className="text-white/60 text-sm leading-relaxed mb-6">
              The ISS is visible to the naked eye — a bright, steady light crossing the sky in a
              few minutes. Allow location access and we&apos;ll compute the next passes over you.
            </p>
            {hasTle ? (
              <PassPredictions line1={l1!} line2={l2!} />
            ) : (
              <p className="text-white/40 text-sm">Pass predictions need live orbital data.</p>
            )}
          </div>
        </div>
      </div>

      <section className="mb-16 max-w-3xl">
        <h2 className="text-2xl font-light mb-8">About the Space Station</h2>
        <dl className="space-y-8">
          {FAQ.map(({ q, a }) => (
            <div key={q}>
              <dt className="font-medium mb-2">{q}</dt>
              <dd className="text-white/60 leading-relaxed">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex flex-wrap gap-4">
        <Link
          href={`/satellites/${ISS_SLUG}`}
          className="border border-white/20 px-5 py-3 text-[12px] tracking-[0.2em] uppercase hover:bg-white/10 transition-colors"
        >
          Full ISS details →
        </Link>
        <Link
          href="/track"
          className="border border-white/20 px-5 py-3 text-[12px] tracking-[0.2em] uppercase hover:bg-white/10 transition-colors"
        >
          Track 15,000+ satellites live →
        </Link>
      </div>
    </div>
  );
}
