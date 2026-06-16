// Thin typed client for the Orbica REST API.
// Server Components call these directly; the base URL points at the Go API.

const BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8080";

async function get<T>(path: string, revalidate = 300): Promise<T> {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    next: { revalidate },
  });
  if (!res.ok) {
    throw new Error(`API ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
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
  timelineYear: (year: number) => get<LaunchRow[]>(`/timeline/years/${year}`),
  agencies: () => get<Agency[]>("/agencies"),
  agency: (id: string) => get<Record<string, unknown>>(`/agencies/${id}`),
  rockets: (q = "") =>
    get<Rocket[]>(`/rockets?limit=200${q ? `&q=${encodeURIComponent(q)}` : ""}`),
  rocket: (id: string) => get<Record<string, unknown>>(`/rockets/${id}`),
  satellites: (q = "") =>
    get<Satellite[]>(`/satellites${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  satellite: (id: string) => get<Record<string, unknown>>(`/satellites/${id}`),
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
