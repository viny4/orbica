export const runtime = "edge";

import Link from "next/link";
import type { Metadata } from "next";
import { api, type Satellite } from "@/lib/api";
import { safe } from "@/components/EmptyState";
import { PageHeader } from "@/components/ui";
import SatelliteBrowser from "@/components/satellites/SatelliteBrowser";
import { filterQuery, type Sat, type SatFilters } from "@/components/satellites/satFilters";

export const metadata: Metadata = {
  title: "Satellites — Orbica",
  description: "Browse 26,000+ catalogued satellites, rocket bodies and debris — filter by purpose, orbit and status, and open any object's live orbit.",
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function SatellitesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const type = one(searchParams.type);
  const filters: SatFilters = {
    purpose: one(searchParams.purpose),
    orbit: one(searchParams.orbit),
    status: one(searchParams.status),
    // Payloads by default; ?type=all shows rocket bodies + debris too.
    type: type === "all" ? "" : type || "PAY",
    q: one(searchParams.q).slice(0, 100),
  };
  const initial = await safe(api.satelliteList(filterQuery(filters)), null);

  return (
    <div>
      <PageHeader
        eyebrow="The live sky · 26,000+ objects"
        title="Satellites"
        actions={
          <Link href="/track" className="btn btn-secondary">
            Live tracker →
          </Link>
        }
      />
      <SatelliteBrowser key={filterQuery(filters)} initialFilters={filters} initialItems={initial as (Sat & Satellite)[] | null} />
    </div>
  );
}
