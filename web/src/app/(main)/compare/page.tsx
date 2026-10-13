export const runtime = "edge";

import type { Metadata } from "next";
import { api } from "@/lib/api";
import { safe } from "@/components/EmptyState";
import { PageHeader } from "@/components/ui";
import CompareClient, { type RocketOption } from "@/components/rockets/CompareClient";

export const metadata: Metadata = {
  title: "Compare Launch Vehicles — Orbica",
  description: "Compare up to three rockets side by side: dimensions, payload capacity, propulsion and launch record, with 3D size comparison.",
};

// The URL (?r=falcon-9&r=ariane-5) is the source of truth: the selected
// vehicles are fetched on the server, in parallel, so a comparison link renders
// complete on first paint. Choosing a vehicle just navigates to a new URL.
export default async function ComparePage({ searchParams }: { searchParams: { r?: string | string[] } }) {
  const raw = searchParams.r;
  const slugs = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(Boolean).slice(0, 3);

  const [all, ...details] = await Promise.all([
    safe(api.rockets(), []),
    ...slugs.map((s) => safe(api.rocket(s), null)),
  ]);

  const options: RocketOption[] = (all as Awaited<ReturnType<typeof api.rockets>>).map((r) => ({
    slug: r.slug,
    name: r.name,
    variant: r.variant ?? null,
    status: r.status,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Fleet analysis"
        title="Compare Vehicles"
        meta="Select up to three launch vehicles to compare specifications, capacity and launch record side by side."
      />
      <CompareClient options={options} slugs={slugs} details={details as (Record<string, any> | null)[]} />
    </div>
  );
}
