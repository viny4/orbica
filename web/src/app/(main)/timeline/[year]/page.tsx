import { api } from "@/lib/api";
import { safe } from "@/components/EmptyState";
import { PageHeader } from "@/components/ui";
import LaunchFeed from "@/components/timeline/LaunchFeed";

export const runtime = "edge";

import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: { year: string } }): Promise<Metadata> {
  const years = await safe(api.timelineYears(), []);
  const yearStr = params.year;
  const total = years.find((y) => y.launch_year === Number(yearStr))?.total_launches ?? 0;
  
  return {
    title: `${yearStr} Spaceflight Timeline — Orbica`,
    description: `Explore the entire historical log of ${total} orbital missions launched during ${yearStr}.`,
  };
}

export default async function YearPage({ params }: { params: { year: string } }) {
  const year = Number(params.year);
  // Total comes from the cached year rollup — the list itself streams in.
  const years = await safe(api.timelineYears(), []);
  const total = years.find((y) => y.launch_year === year)?.total_launches ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Launch Year"
        title={String(year)}
        meta={`${total} launch${total === 1 ? "" : "es"}`}
        back={{ href: "/timeline", label: "Timeline" }}
      />
      <LaunchFeed year={year} />
    </div>
  );
}
