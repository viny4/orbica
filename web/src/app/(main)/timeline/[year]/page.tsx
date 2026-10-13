import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { api } from "@/lib/api";
import { safe } from "@/components/EmptyState";
import { PageHeader } from "@/components/ui";
import LaunchFeed from "@/components/timeline/LaunchFeed";

export const runtime = "edge";

const FIRST_YEAR = 1957;

function parseYear(raw: string): number | null {
  if (!/^\d{4}$/.test(raw)) return null;
  const y = Number(raw);
  return y >= FIRST_YEAR && y <= new Date().getUTCFullYear() + 5 ? y : null;
}

export async function generateMetadata({ params }: { params: { year: string } }): Promise<Metadata> {
  const year = parseYear(params.year);
  if (year === null) notFound();
  const years = await safe(api.timelineYears(), []);
  const total = years.find((y) => y.launch_year === year)?.total_launches;
  return {
    title: `${year} Spaceflight Timeline — Orbica`,
    description: total
      ? `Every one of the ${total} orbital launches attempted in ${year}, with outcomes, vehicles and payloads.`
      : `Orbital launches attempted in ${year}, with outcomes, vehicles and payloads.`,
    alternates: { canonical: `https://orbica.space/timeline/${year}` },
  };
}

export default async function YearPage({ params }: { params: { year: string } }) {
  const year = parseYear(params.year);
  if (year === null) notFound();

  // Totals come from the cached year rollup — the list itself streams in.
  const years = await safe(api.timelineYears(), []);
  const summary = years.find((y) => y.launch_year === year);
  const total = summary?.total_launches ?? 0;
  const known = new Set(years.map((y) => y.launch_year));
  const prev = known.has(year - 1) ? year - 1 : null;
  const next = known.has(year + 1) ? year + 1 : null;

  return (
    <div>
      <PageHeader
        eyebrow="Launch year"
        title={String(year)}
        back={{ href: "/timeline", label: "Timeline" }}
        meta={
          summary ? (
            <span className="flex flex-wrap gap-x-6 gap-y-1 font-mono">
              <span><span className="text-ink">{total}</span> launch{total === 1 ? "" : "es"}</span>
              <span><span className="text-success">{summary.successes}</span> successful</span>
              {summary.failures > 0 && <span><span className="text-danger">{summary.failures}</span> failed</span>}
              <span>{summary.agencies_active} agencies</span>
            </span>
          ) : undefined
        }
        actions={
          <div className="flex gap-2">
            {prev && (
              <Link href={`/timeline/${prev}`} className="btn btn-secondary" aria-label={`Previous year, ${prev}`}>
                ← {prev}
              </Link>
            )}
            {next && (
              <Link href={`/timeline/${next}`} className="btn btn-secondary" aria-label={`Next year, ${next}`}>
                {next} →
              </Link>
            )}
          </div>
        }
      />
      {/* Keyed so prev/next navigation starts a fresh feed instead of
          appending the new year's launches to the old year's list. */}
      <LaunchFeed key={year} year={year} />
    </div>
  );
}
