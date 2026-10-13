import Link from "next/link";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { api } from "@/lib/api";
import { safe } from "@/components/EmptyState";
import { PageHeader, Chip, SpecList } from "@/components/ui";
import { News } from "@/components/News";
import { JsonLd, breadcrumbSchema } from "@/components/JsonLd";
import { Flag } from "@/components/Flag";
import SatelliteVisual from "@/components/satellites/SatelliteVisual";

export const runtime = "edge";

type Sat = Record<string, any>;

const OPS: Record<string, string> = {
  "+": "Operational",
  "-": "Nonoperational",
  P: "Partially operational",
  B: "Backup / standby",
  S: "Spare",
  X: "Extended mission",
  D: "Decayed",
  "?": "Unknown",
};

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  // null → the satellite doesn't exist: 404 here, before streaming starts, so
  // the response carries a real 404 status. Upstream errors fall through to a
  // generic title and let the page's error boundary handle them.
  const sat = await api.satellite(params.id).catch(() => undefined);
  if (sat === null) notFound();
  if (!sat) return { title: "Satellite — Orbica" };
  return {
    title: `${sat.name} — Orbica`,
    description: `Details and real-time orbit tracking for ${sat.name}${sat.norad_id ? ` (NORAD ${sat.norad_id})` : ""}. Purpose: ${sat.purpose ?? "Unknown"}. Status: ${OPS[sat.ops_status] ?? sat.status ?? "Unknown"}.`,
    alternates: { canonical: `https://orbica.space/satellites/${sat.slug || params.id}` },
  };
}

const PassPredictions = dynamic(
  () => import("@/components/satellites/PassPredictions").then((m) => m.PassPredictions),
  { ssr: false },
);

// Always format in UTC so the launch date matches the source (and isn't shifted
// by the server's local timezone).
function fmtDate(d?: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
}
function fmtDateTime(d?: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleString("en-US", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
  });
}

const PURPOSE_BLURB: Record<string, string> = {
  Communications: "Relays voice, data, internet or broadcast signals between points on Earth.",
  Navigation: "Broadcasts precise timing/positioning signals for global navigation (GNSS).",
  Weather: "Observes the atmosphere and oceans for meteorology and climate monitoring.",
  "Earth Observation": "Images and senses the Earth's surface for mapping, agriculture, defense or science.",
  "Space Telescope": "An orbiting observatory studying the cosmos free of atmospheric distortion.",
  "Human Spaceflight": "Carries or supports astronauts — a crewed vehicle, station or resupply craft.",
  "Planetary Science": "An interplanetary probe exploring other worlds across the solar system.",
  Technology: "Demonstrates or validates new spacecraft technology in orbit.",
  Payload: "A catalogued spacecraft payload.",
  "Rocket Body": "A spent upper stage left in orbit after deployment.",
  Debris: "Catalogued fragmentation or mission-related debris.",
};

const DEEP_SPACE = ["Interstellar", "Heliocentric", "Lunar", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "Asteroid", "Comet", "Deep Space", "Earth-Moon L-point"];

const accentLink = "text-accent hover:underline underline-offset-4";

export default async function SatelliteDetailPage({ params }: { params: { id: string } }) {
  // The satellite itself is required (outage → error page, missing → 404);
  // the TLE and news are enrichments that degrade quietly.
  const [sat, tle, articles] = await Promise.all([
    api.satellite(params.id),
    safe(api.satelliteTle(params.id), null),
    safe(api.satelliteArticles(params.id), []),
  ]);
  if (!sat) notFound();

  const launch = sat.launch as Record<string, any> | null;
  const site = sat.launch_site as Record<string, any> | null;
  const isDeepSpace = DEEP_SPACE.includes(sat.orbit_type);
  const hasTle = Boolean(tle?.tle_line1 && tle?.tle_line2);
  const blurb = sat.purpose ? PURPOSE_BLURB[sat.purpose] : null;

  // Mission lifetime + fate for satellites that are no longer working.
  const defunct =
    sat.status === "decayed" || sat.ops_status === "-" || sat.ops_status === "D" || Boolean(sat.reentry_date);
  let duration: string | null = null;
  if (sat.launch_date && sat.reentry_date) {
    const days = Math.round((+new Date(sat.reentry_date) - +new Date(sat.launch_date)) / 86400000);
    duration = days >= 365 ? `${(days / 365.25).toFixed(1)} years` : `${days} days`;
  }
  const fate = sat.reentry_date
    ? isDeepSpace
      ? `Mission ended at ${sat.orbit_type}.`
      : "Reentered Earth's atmosphere and was destroyed."
    : sat.ops_status === "-" || sat.ops_status === "D"
      ? "No longer operational — remains in orbit as inactive."
      : null;
  const endRows: [string, React.ReactNode][] = [
    ["Last active / ended", fmtDate(sat.reentry_date)],
    ["Time in service", duration],
    ["Fate", fate],
    ["Final status", OPS[sat.ops_status] ?? sat.status],
  ];

  const launchRows: [string, React.ReactNode][] = [
    // Prefer the linked launch's precise UTC time; fall back to the catalogue date.
    ["Launch date", launch?.launch_time ? fmtDateTime(launch.launch_time) : fmtDate(sat.launch_date)],
    ["Launch site", site ? site.name : sat.launch_site_code],
    [
      "Launched by",
      launch?.rocket_slug ? (
        <Link href={`/rockets/${launch.rocket_slug}`} className={accentLink}>
          {launch.rocket_name} →
        </Link>
      ) : (
        launch?.rocket_name
      ),
    ],
    ["Operator", launch?.agency_name],
    ["Mission", launch?.mission_name],
    [
      "Launch record",
      launch?.launch_id ? (
        <Link href={`/launches/${launch.launch_id}`} className={accentLink}>
          View full launch →
        </Link>
      ) : null,
    ],
  ];

  // Spacecraft physical/operational specs (from the UCS database).
  const physicalRows: [string, React.ReactNode][] = [
    ["Operator", sat.operator_name],
    ["Manufacturer", sat.contractor],
    ["Users", sat.users],
    ["Launch mass", sat.mass_kg && `${Number(sat.mass_kg).toLocaleString()} kg`],
    ["Dry mass", sat.dry_mass_kg && `${Number(sat.dry_mass_kg).toLocaleString()} kg`],
    ["Power", sat.power_watts && `${Number(sat.power_watts).toLocaleString()} W`],
    ["Design lifetime", sat.expected_lifetime_years && `${sat.expected_lifetime_years} years`],
    ["Dimensions", sat.dimensions],
    ["Detailed purpose", sat.purpose_detail],
  ];

  const orbitRows: [string, React.ReactNode][] = isDeepSpace
    ? [
        ["Regime", `Interplanetary — ${sat.orbit_type}`],
        ["Reference body", sat.orbit_type],
      ]
    : [
        ["Orbit regime", sat.orbit_type],
        ["Apoapsis", sat.altitude_apoapsis_km && `${Number(sat.altitude_apoapsis_km).toLocaleString()} km`],
        ["Periapsis", sat.altitude_periapsis_km && `${Number(sat.altitude_periapsis_km).toLocaleString()} km`],
        ["Inclination", sat.inclination_deg && `${sat.inclination_deg}°`],
        ["Orbital period", sat.period_minutes && `${sat.period_minutes} min`],
        ["Orbit data fetched", tle?.captured_at ? fmtDateTime(tle.captured_at) : null],
      ];

  const owner = sat.owner_info as Record<string, any> | null;
  const idRows: [string, React.ReactNode][] = [
    ["COSPAR (Int'l)", sat.cospar_id],
    ["NORAD catalog №", sat.norad_id],
    ["Object type", sat.object_type === "PAY" ? "Payload" : sat.object_type],
    [
      "Owner / operator",
      owner ? (
        <span className="inline-flex items-center gap-2">
          {owner.country_code && <Flag code={owner.country_code} className="h-3 w-4 rounded-[2px]" />}
          {owner.name}
        </span>
      ) : (
        sat.owner_code
      ),
    ],
    [
      "Constellation",
      sat.constellation ? (
        <Link href={`/constellations/${encodeURIComponent(sat.constellation.toLowerCase())}`} className={accentLink}>
          {sat.constellation}
        </Link>
      ) : null,
    ],
    ["Radar cross-section", sat.rcs_m2 && `${sat.rcs_m2} m²`],
    ["Status", OPS[sat.ops_status] ?? sat.status],
    ["Decay / reentry", fmtDate(sat.reentry_date)],
  ];

  const statusLabel = OPS[sat.ops_status] ?? sat.status ?? "unknown";
  const active = sat.status === "active" || sat.ops_status === "+";

  return (
    <div>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Satellites", path: "/satellites" },
          { name: String(sat.name), path: `/satellites/${sat.slug || params.id}` },
        ])}
      />
      <PageHeader
        eyebrow={[sat.constellation, sat.purpose].filter(Boolean).join(" · ") || "Spacecraft"}
        title={String(sat.name)}
        back={{ href: "/satellites", label: "Satellites" }}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <Chip tone={active ? "success" : "muted"}>{statusLabel}</Chip>
            {sat.purpose && <Chip tone="accent">{sat.purpose}</Chip>}
            {sat.orbit_type && <Chip>{sat.orbit_type}</Chip>}
            {sat.norad_id && <Chip>NORAD {sat.norad_id}</Chip>}
          </span>
        }
        actions={
          hasTle && !isDeepSpace ? (
            <Link href="/track" className="btn btn-secondary">
              Live tracker →
            </Link>
          ) : undefined
        }
      />

      {(sat.description || blurb) && (
        <div className="-mt-4 mb-10 max-w-3xl">
          <p className="font-light leading-relaxed text-ink-2">{sat.description || blurb}</p>
          {sat.wikipedia_url && (
            <a
              href={sat.wikipedia_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block font-mono text-[11px] uppercase tracking-[0.2em] text-accent/80 hover:text-accent"
            >
              Read more on Wikipedia ↗
            </a>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <SatelliteVisual
          name={String(sat.name)}
          line1={tle?.tle_line1}
          line2={tle?.tle_line2}
          imageUrl={sat.image_url}
          purpose={sat.purpose}
          orbitType={sat.orbit_type}
        />
        <div className="space-y-10">
          <SpecList title="Launch" rows={launchRows} />
          <SpecList title={isDeepSpace ? "Trajectory" : "Orbit"} rows={orbitRows} />
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <SpecList title="Spacecraft" rows={physicalRows} />
        <SpecList title="Identity" rows={idRows} />
      </div>

      {defunct && (
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <SpecList title="End of mission" rows={endRows} tone="danger" />
        </div>
      )}

      {/* Visible passes — only meaningful for trackable Earth-orbit objects. */}
      {hasTle && !isDeepSpace && <PassPredictions line1={tle!.tle_line1!} line2={tle!.tle_line2!} />}

      <News articles={articles} heading="Related news" />
    </div>
  );
}
