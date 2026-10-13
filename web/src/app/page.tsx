export const runtime = "edge";
import Link from "next/link";
import { Suspense } from "react";
import HeroScene from "@/components/home/HeroScene";
import { SectionTitle } from "@/components/ui";
import {
  AgenciesSection,
  AnomaliesSection,
  HeroLive,
  HeroLiveSkeleton,
  OnThisDaySection,
  PreviewsSection,
  PreviewsSkeleton,
  StatsBand,
  StatsBandSkeleton,
  UpcomingSection,
  UpcomingSkeleton,
} from "@/components/home/sections";

// The landing page streams: the hero (static copy + CSS planet) is sent
// immediately, and each data section fills in as its own fetch resolves — so
// time-to-first-byte no longer waits on the slowest upstream, and a failing
// source only empties its own section. Skeletons reserve each section's space
// so nothing shifts when data lands.
export default function Home() {
  return (
    <div className="bg-void">
      {/* ───────────────────── HERO ───────────────────── */}
      <section className="relative isolate h-[100svh] min-h-[600px] w-full overflow-hidden" aria-labelledby="hero-title">
        <div aria-hidden className="grid-lines absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_60%_55%,black,transparent)]" />
        <HeroScene />
        {/* Legibility scrims: horizontal on wide screens, vertical on phones
            where the planet's limb sits under the copy. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-void via-void/55 to-transparent max-md:bg-gradient-to-b max-md:from-void/90 max-md:via-void/40" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-void to-transparent" />

        <div className="shell relative z-10 flex h-full flex-col justify-start pt-28 md:justify-center md:pt-0">
          <div className="max-w-3xl">
            <p className="eyebrow rise" style={{ ["--i" as string]: 0 }}>
              Orbital record system · est. 1957
            </p>
            <h1 id="hero-title" className="mt-6 text-display font-extralight uppercase tracking-tighter">
              {/* No entrance animation on the headline: it's the LCP element,
                  and fading it in from transparent delays when the page counts
                  as painted. The supporting copy around it still rises in. */}
              <span className="block">Every rocket.</span>
              <span className="block bg-gradient-to-r from-white via-white to-accent bg-clip-text text-transparent">Every satellite.</span>
            </h1>
            <p className="rise mt-7 max-w-[34rem] text-base font-light leading-relaxed text-ink-2 sm:text-lg" style={{ ["--i" as string]: 3 }}>
              The complete record of human spaceflight — seventy years of launches, the vehicles
              that flew them, and tens of thousands of orbits propagated live.
            </p>
            <div className="rise mt-9 flex flex-wrap gap-3" style={{ ["--i" as string]: 4 }}>
              <Link href="/timeline" className="btn btn-primary">
                Explore the archive
              </Link>
              <Link href="/track" className="btn btn-secondary">
                Open live tracker
              </Link>
            </div>
            <div className="rise mt-10 min-h-4" style={{ ["--i" as string]: 5 }}>
              <Suspense fallback={<HeroLiveSkeleton />}>
                <HeroLive />
              </Suspense>
            </div>
          </div>
        </div>

        <a
          href="#overview"
          className="absolute bottom-7 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-3 font-mono text-[9px] uppercase tracking-[0.35em] text-ink-4 transition-colors hover:text-ink-2 md:flex"
        >
          Scroll
          <span aria-hidden className="h-10 w-px bg-gradient-to-b from-ink-4 to-transparent" />
        </a>
      </section>

      {/* ───────────────────── OVERVIEW ───────────────────── */}
      <section id="overview" className="shell relative -mt-px scroll-mt-20 pt-6">
        <Suspense fallback={<StatsBandSkeleton />}>
          <StatsBand />
        </Suspense>
      </section>

      {/* ───────────────────── NEXT LAUNCHES ───────────────────── */}
      <section className="shell py-20 sm:py-24">
        <SectionTitle eyebrow="Live countdowns" title="Next launches" action={{ href: "/upcoming", label: "Full manifest" }} />
        <Suspense fallback={<UpcomingSkeleton />}>
          <UpcomingSection />
        </Suspense>
      </section>

      {/* ───────────────────── PLATFORM PREVIEWS ───────────────────── */}
      <section className="shell pb-4">
        <SectionTitle
          eyebrow="Inside Orbica"
          title="Live sky, deep archive"
          description="A real-time view of what's in orbit, and the full history of how it got there."
        />
        <Suspense fallback={<PreviewsSkeleton />}>
          <PreviewsSection />
        </Suspense>
      </section>

      <Suspense fallback={null}>
        <OnThisDaySection />
      </Suspense>
      <Suspense fallback={null}>
        <AgenciesSection />
      </Suspense>
      <Suspense fallback={null}>
        <AnomaliesSection />
      </Suspense>
    </div>
  );
}
