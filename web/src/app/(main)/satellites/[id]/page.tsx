import Link from "next/link";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { safe } from "@/components/EmptyState";
import { PageHeader, Chip } from "@/components/ui";
import { News } from "@/components/News";
import { Flag } from "@/components/Flag";

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

type Sat = Record<string, any>;
interface Tle {
  tle_line1?: string;
  tle_line2?: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8090";

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

function Section({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  const visible = rows.filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (!visible.length) return null;
  return (
    <div>
      <h2 className="text-[11px] tracking-[0.3em] uppercase text-white/45 mb-4">{title}</h2>
      <dl className="divide-y divide-white/10 border-y border-white/10">
        {visible.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 py-3">
            <dt className="text-[13px] tracking-wide text-white/45">{k}</dt>
            <dd className="font-mono text-sm text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default async function SatelliteDetailPage({ params }: { params: { id: string } }) {
  const [sat, tle, articles] = await Promise.all([
    safe<Sat | null>(api.satellite(params.id), null),
    safe<Tle | null>(
      fetch(`${API}/api/v1/satellites/${params.id}/tle`, { next: { revalidate: 3600 } }).then((r) =>
        r.ok ? r.json() : null,
      ),
      null,
    ),
    safe(api.satelliteArticles(params.id), []),
  ]);

  if (!sat) return <PageHeader title="Not found" back={{ href: "/satellites", label: "Satellites" }} />;

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
        <Link href={`/rockets/${launch.rocket_slug}`} className="text-[var(--color-space-accent-2)] hover:underline">
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
        <Link href={`/launches/${launch.launch_id}`} className="text-[var(--color-space-accent-2)] hover:underline">
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
          {owner.country_code && <Flag code={owner.country_code} className="w-4 h-3 rounded-[2px]" />}
          {owner.name}
        </span>
      ) : (
        sat.owner_code
      ),
    ],
    ["Constellation", sat.constellation],
    ["Radar cross-section", sat.rcs_m2 && `${sat.rcs_m2} m²`],
    ["Status", OPS[sat.ops_status] ?? sat.status],
    ["Decay / reentry", fmtDate(sat.reentry_date)],
  ];

  return (
    <div>
      <PageHeader
        eyebrow={[sat.constellation, sat.purpose].filter(Boolean).join(" · ") || "Spacecraft"}
        title={String(sat.name)}
        back={{ href: "/satellites", label: "Satellites" }}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <Chip>{OPS[sat.ops_status] ?? sat.status ?? "unknown"}</Chip>
            {sat.purpose && <Chip tone="accent">{sat.purpose}</Chip>}
            {sat.orbit_type && <Chip>{sat.orbit_type}</Chip>}
          </span>
        }
      />

      {(sat.description || blurb) && (
        <div className="-mt-6 mb-10 max-w-3xl">
          <p className="text-white/60 font-light leading-relaxed">{sat.description || blurb}</p>
          {sat.wikipedia_url && (
            <a
              href={sat.wikipedia_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-[11px] tracking-[0.2em] uppercase text-[var(--color-space-accent-2)]/80 hover:text-[var(--color-space-accent-2)]"
            >
              Read more on Wikipedia →
            </a>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <SatelliteVisual
          name={String(sat.name)}
          line1={tle?.tle_line1}
          line2={tle?.tle_line2}
          imageUrl={sat.image_url}
          purpose={sat.purpose}
          orbitType={sat.orbit_type}
        />
        <div className="space-y-8">
          <Section title="Launch" rows={launchRows} />
          <Section title={isDeepSpace ? "Trajectory" : "Orbit"} rows={orbitRows} />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Section title="Spacecraft" rows={physicalRows} />
        <Section title="Identity" rows={idRows} />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {defunct && (
          <div>
            <h2 className="text-[11px] tracking-[0.3em] uppercase text-red-400/70 mb-4">End of mission</h2>
            <dl className="divide-y divide-white/10 border-y border-white/10">
              {endRows
                .filter(([, v]) => v !== null && v !== undefined && v !== "")
                .map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-[13px] tracking-wide text-white/45">{k}</dt>
                    <dd className="font-mono text-sm text-right">{v}</dd>
                  </div>
                ))}
            </dl>
          </div>
        )}
      </div>

      {/* Visible passes — only meaningful for trackable Earth-orbit objects. */}
      {hasTle && !isDeepSpace && (
        <PassPredictions line1={tle!.tle_line1!} line2={tle!.tle_line2!} />
      )}

      <News articles={articles} heading="Related news" />
    </div>
  );
}
