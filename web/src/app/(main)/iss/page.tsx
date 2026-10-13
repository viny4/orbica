// "Where is the ISS right now?" — a dedicated landing page for one of the most
// common space searches. Live position from the newest TLE, the 3D orbit view,
// visible-pass predictions, and indexable FAQ copy (mirrored in FAQPage JSON-LD).

import Link from "next/link";
import dynamic from "next/dynamic";
import type { Metadata } from "next";
import { api } from "@/lib/api";
import { safe } from "@/components/EmptyState";
import { JsonLd, breadcrumbSchema, faqSchema } from "@/components/JsonLd";
import { Eyebrow, SectionHeader } from "@/components/ui";
import SatelliteVisual from "@/components/satellites/SatelliteVisual";

export const runtime = "edge";

const ISS_SLUG = "iss-zarya"; // NORAD 25544

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

const IssLiveStats = dynamic(() => import("@/components/iss/IssLiveStats"), {
  ssr: false,
  loading: () => <div className="h-[118px] animate-pulse border border-line bg-white/[0.015]" aria-hidden />,
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
  const [sat, tle] = await Promise.all([safe(api.satellite(ISS_SLUG), null), safe(api.satelliteTle(ISS_SLUG), null)]);

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
        <Eyebrow>International Space Station · NORAD 25544</Eyebrow>
        <h1 className="mt-4 text-title font-light tracking-tight text-balance">Where is the ISS right now?</h1>
        <p className="mt-5 max-w-2xl leading-relaxed text-ink-2">
          The station is moving at ~7.66 km per second. Its position below updates every second,
          propagated in your browser from the latest published orbital elements.
        </p>
      </header>

      {hasTle ? (
        <div className="mb-12">
          <IssLiveStats line1={l1!} line2={l2!} />
        </div>
      ) : (
        <p className="mb-12 text-sm text-ink-3">Live orbital data is briefly unavailable — try refreshing in a minute.</p>
      )}

      <div className="mb-16 grid gap-8 lg:grid-cols-2">
        <section>
          <SectionHeader title="Orbit view" />
          <SatelliteVisual
            name={String(sat?.name ?? "ISS (ZARYA)")}
            line1={l1}
            line2={l2}
            imageUrl={(sat?.image_url as string) ?? null}
            purpose={(sat?.purpose as string) ?? null}
            orbitType={(sat?.orbit_type as string) ?? null}
          />
        </section>
        <section>
          <SectionHeader title="When can I see it from my location?" />
          <div className="card p-6">
            <p className="mb-6 text-sm leading-relaxed text-ink-2">
              The ISS is visible to the naked eye — a bright, steady light crossing the sky in a
              few minutes. Allow location access and we&apos;ll compute the next passes over you.
            </p>
            {hasTle ? (
              <PassPredictions line1={l1!} line2={l2!} />
            ) : (
              <p className="text-sm text-ink-3">Pass predictions need live orbital data.</p>
            )}
          </div>
        </section>
      </div>

      <section className="mb-16 max-w-3xl">
        <h2 className="mb-8 text-heading font-light">About the Space Station</h2>
        <dl className="space-y-8">
          {FAQ.map(({ q, a }) => (
            <div key={q}>
              <dt className="mb-2 font-medium">{q}</dt>
              <dd className="leading-relaxed text-ink-2">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href={`/satellites/${ISS_SLUG}`} className="btn btn-secondary">
          Full ISS details →
        </Link>
        <Link href="/track" className="btn btn-secondary">
          Track 15,000+ satellites live →
        </Link>
      </div>
    </div>
  );
}
