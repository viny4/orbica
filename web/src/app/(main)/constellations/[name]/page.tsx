import { api } from "@/lib/api";
import { safe } from "@/components/EmptyState";
import { PageHeader, Chip } from "@/components/ui";
import dynamic from "next/dynamic";
import Link from "next/link";
import ClientConstellationContent from "./ClientConstellationContent";

export const runtime = "edge";

interface Props {
  params: {
    name: string;
  };
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

export async function generateMetadata({ params }: Props) {
  const displayName = formatConstellationName(params.name);
  return {
    title: `${displayName} Constellation — Orbica`,
    description: `Real-time 3D tracking and telemetry for the ${displayName} satellite network.`,
  };
}

export default async function ConstellationPage({ params }: Props) {
  const nameDecoded = decodeURIComponent(params.name);
  const satellites = await safe(api.constellation(nameDecoded), []);

  const displayName = formatConstellationName(params.name);

  if (!satellites.length) {
    return (
      <div>
        <PageHeader
          title={displayName}
          back={{ href: "/satellites", label: "Satellites" }}
          eyebrow="Constellation"
        />
        <div className="border border-white/10 bg-white/[0.015] p-12 text-center">
          <p className="text-white/40 text-sm">
            No active satellites found in database for constellation &ldquo;{nameDecoded}&rdquo;.
          </p>
          <div className="mt-6">
            <Link
              href="/satellites"
              className="text-xs font-mono uppercase tracking-widest text-[var(--color-space-accent-2)] hover:underline"
            >
              Back to Catalog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Calculate statistics from the retrieved constellation satellites
  const activeSats = satellites.filter((s) => s.status?.toLowerCase() === "active").length;
  
  // Altitudes
  const peris = satellites.map((s) => Number(s.altitude_periapsis_km || 0)).filter((v) => v > 0);
  const apos = satellites.map((s) => Number(s.altitude_apoapsis_km || 0)).filter((v) => v > 0);
  const minPeri = peris.length ? Math.min(...peris) : 0;
  const maxApo = apos.length ? Math.max(...apos) : 0;
  
  // Inclination
  const incs = satellites.map((s) => Number(s.inclination_deg || 0)).filter((v) => v > 0);
  const avgInc = incs.length ? incs.reduce((a, b) => a + b, 0) / incs.length : 0;

  const stats = {
    total: satellites.length,
    active: activeSats,
    altitude: minPeri && maxApo ? `${minPeri.toFixed(0)} – ${maxApo.toFixed(0)} km` : "—",
    inclination: avgInc ? `${avgInc.toFixed(1)}°` : "—",
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        eyebrow="Satellite Network"
        title={`${displayName} Constellation`}
        back={{ href: "/satellites", label: "Catalog" }}
        meta={
          <span className="flex items-center gap-2">
            <Chip tone="accent">{stats.active} / {stats.total} operational</Chip>
            <Chip>{satellites[0].orbit_type || "Various Orbits"}</Chip>
          </span>
        }
      />

      <ClientConstellationContent
        satellites={satellites}
        stats={stats}
        constellationName={displayName}
      />
    </div>
  );
}
