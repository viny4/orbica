// Thin typed client for the Orbica REST API.
// Server Components call these directly; the base URL points at the Go API.

const BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8080";

async function get<T>(path: string, revalidate = 300): Promise<T> {
  const url = `${BASE}/api/v1${path}`;
  // The API runs on a free dyno that can briefly cold-start. Retry a couple of
  // times (with a timeout) so a momentary wake-up doesn't render an empty page.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        next: { revalidate },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2500));
    }
  }
  throw lastErr;
}

// --- Domain types (subset of the schema the UI needs) ---

export interface YearSummary {
  launch_year: number;
  total_launches: number;
  successes: number;
  failures: number;
  agencies_active: number;
}

export interface LaunchRow {
  id: string;
  name: string;
  mission_name: string | null;
  launch_time: string | null;
  outcome: string;
  rocket_id: string | null;
  rocket_slug: string | null;
  rocket_name: string | null;
  agency_id: string | null;
  agency_name: string | null;
}

export interface Agency {
  id: string;
  slug: string;
  name: string;
  abbrev: string | null;
  country_code: string | null;
  agency_type: string | null;
  total_launches: number;
  logo_url: string | null;
}

export interface Rocket {
  id: string;
  slug: string;
  name: string;
  variant?: string | null;
  status: string | null;
  height_m: string | null;
  diameter_m: string | null;
  payload_leo_kg: string | null;
  reusable: boolean;
  total_launches: number;
  successful_launches: number;
  failed_launches: number;
  image_url: string | null;
  model_3d_url: string | null;
  first_flight: string | null;
  last_flight: string | null;
}

export interface Satellite {
  id: string;
  slug: string;
  name: string;
  norad_id: number | null;
  purpose: string | null;
  constellation: string | null;
  orbit_type: string | null;
  status: string | null;
  owner_code: string | null;
  object_type: string | null;
  launch_date: string | null;
  launch_year: number | null;
  image_url: string | null;
  altitude_periapsis_km?: string | number | null;
  altitude_apoapsis_km?: string | number | null;
  inclination_deg?: string | number | null;
}

export interface Article {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  image_url: string | null;
  news_site: string | null;
  published_at: string | null;
}

export interface SyncLog {
  id: string;
  timestamp: string;
  job_name: string;
  status: string;
  records_added: number;
  records_updated: number;
  details: Record<string, any> | null;
}

export const api = {
  timelineYears: () => get<YearSummary[]>("/timeline/years"),
  rocketArticles: (id: string) => get<Article[]>(`/rockets/${id}/articles`, 600),
  satelliteArticles: (id: string) => get<Article[]>(`/satellites/${id}/articles`, 600),
  rocketPayloads: (id: string) => get<Satellite[]>(`/rockets/${id}/payloads`),
  launch: (id: string) => get<Record<string, any>>(`/launches/${id}`),
  intelSpaceWeather: () => get<Record<string, any> | null>("/intel/spaceweather", 300),
  intelEvents: () => get<any[]>("/intel/events", 300),
  intelConjunctions: () => get<any[]>("/intel/conjunctions", 300),
  intelReentries: () => get<any[]>("/intel/reentries", 300),
  onThisDay: () => get<LaunchRow[]>("/timeline/on-this-day", 3600),
  timelineYear: (year: number) => get<LaunchRow[]>(`/timeline/years/${year}`),
  upcoming: (limit = 4) => get<LaunchRow[]>(`/launches/upcoming?limit=${limit}`, 60),
  failures: (limit = 100, offset = 0) => get<LaunchRow[]>(`/launches/failures?limit=${limit}&offset=${offset}`, 60),
  agencies: () => get<Agency[]>("/agencies"),
  agency: (id: string) => get<Record<string, unknown>>(`/agencies/${id}`),
  rockets: (q = "") =>
    get<Rocket[]>(`/rockets?limit=1000${q ? `&q=${encodeURIComponent(q)}` : ""}`),
  rocket: (id: string) => get<Record<string, unknown>>(`/rockets/${id}`),
  satellites: (q = "") =>
    get<Satellite[]>(`/satellites${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  satellite: (id: string) => get<Record<string, unknown>>(`/satellites/${id}`),
  // Full slug list (26k+) — sitemap only; cached a day.
  satelliteSlugs: () => get<{ slug: string }[]>("/satellites/slugs", 86400),
  constellation: (name: string) => get<Satellite[]>(`/constellations/${encodeURIComponent(name)}`),
  constellations: () => get<{ name: string; count: number }[]>("/constellations"),
  syncLogs: (limit = 50) => get<SyncLog[]>(`/sync-logs?limit=${limit}`, 5),
};

export function getLaunchTitle(
  missionName: string | null | undefined,
  launchName: string,
  rocketName: string | null | undefined
): string {
  const mName = missionName?.trim() || "";
  const isUnknown =
    !mName ||
    mName.toLowerCase() === "unknown payload" ||
    mName.toLowerCase().includes("kosmos (unknown payload)") ||
    mName.toLowerCase().includes("unknown payload") ||
    mName.toLowerCase() === "unknown";

  if (isUnknown) {
    if (rocketName) {
      return `${rocketName} Launch`;
    }
    const cleanedLaunchName = launchName
      .replace(/\s*\|\s*Unknown Payload/i, "")
      .replace(/\s*\|\s*Kosmos \(Unknown Payload\)/i, "");
    return cleanedLaunchName || "Classified Launch";
  }

  return mName;
}
