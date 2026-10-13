import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { api, type Satellite } from "@/lib/api";
import { PageHeader, Chip } from "@/components/ui";
import ClientConstellationContent from "./ClientConstellationContent";

export const runtime = "edge";

interface Props {
  params: { name: string };
}

// Capitalize the constellation name for display (e.g., starlink -> Starlink, gps -> GPS)
function formatConstellationName(slug: string): string {
  const name = decodeURIComponent(slug);
  if (name.toLowerCase() === "gps") return "GPS";
  if (name.toLowerCase() === "glonass") return "GLONASS";
  return name
    .split(/[-_ ]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// An empty member list means the constellation doesn't exist (the API answers
// [] rather than 404); an upstream failure throws and reaches the error page.
async function load(name: string): Promise<Satellite[]> {
  const sats = await api.constellation(decodeURIComponent(name));
  return Array.isArray(sats) ? sats : [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const sats = await load(params.name).catch(() => undefined);
  if (sats && sats.length === 0) notFound();
  const displayName = formatConstellationName(params.name);
  return {
    title: `${displayName} Constellation — Orbica`,
    description: `Real-time 3D tracking and telemetry for the ${displayName} satellite network${sats ? ` — ${sats.length.toLocaleString("en-US")} satellites` : ""}.`,
  };
}

export default async function ConstellationPage({ params }: Props) {
  const satellites = await load(params.name);
  if (!satellites.length) notFound();

  const displayName = formatConstellationName(params.name);
  const activeSats = satellites.filter((s) => s.status?.toLowerCase() === "active").length;

  const peris = satellites.map((s) => Number(s.altitude_periapsis_km || 0)).filter((v) => v > 0);
  const apos = satellites.map((s) => Number(s.altitude_apoapsis_km || 0)).filter((v) => v > 0);
  const minPeri = peris.length ? Math.min(...peris) : 0;
  const maxApo = apos.length ? Math.max(...apos) : 0;
  const incs = satellites.map((s) => Number(s.inclination_deg || 0)).filter((v) => v > 0);
  const avgInc = incs.length ? incs.reduce((a, b) => a + b, 0) / incs.length : 0;

  const stats = {
    total: satellites.length,
    active: activeSats,
    altitude: minPeri && maxApo ? `${minPeri.toFixed(0)} – ${maxApo.toFixed(0)} km` : "—",
    inclination: avgInc ? `${avgInc.toFixed(1)}°` : "—",
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        eyebrow="Satellite network"
        title={`${displayName} Constellation`}
        back={{ href: "/constellations", label: "Constellations" }}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <Chip tone="accent">
              {stats.active.toLocaleString("en-US")} / {stats.total.toLocaleString("en-US")} operational
            </Chip>
            <Chip>{satellites[0].orbit_type || "Various orbits"}</Chip>
          </span>
        }
      />
      <ClientConstellationContent satellites={satellites} stats={stats} constellationName={displayName} />
    </div>
  );
}
