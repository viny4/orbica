// Thin typed client for the Orbica REST API.
// Server Components call these directly; the base URL points at the Go API.

import { cache } from "react";
import { rpcEnabled, rpcPrimary, rpcFetch, route, withTimeout } from "./rpc";

// When the REST API fails we stop hammering it for a short window, so an outage
// costs one timeout rather than one per request.
const PRIMARY_RETRY_MS = 60_000;
let restDownUntil = 0;

const BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8090";

/**
 * An upstream answered, but not with data. `status` is the HTTP status (0 for a
 * network failure or timeout), so callers can tell "this doesn't exist" (404)
 * from "the backends are down" — the difference between a real 404 page and an
 * error page that asks search engines to come back later.
 */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export const isNotFound = (e: unknown) => e instanceof ApiError && e.status === 404;

interface GetOpts {
  /** Per-attempt timeout. Defaults suit page renders; widgets pass less. */
  timeoutMs?: number;
  /** Cap REST retries (cold-dyno retries are for content, not decoration). */
  attempts?: number;
}

/** Query Supabase. One shot — PostgREST either answers or it doesn't. */
async function viaRpc<T>(path: string, revalidate: number, timeoutMs?: number): Promise<T> {
  const res = await rpcFetch(path, { revalidate, timeoutMs });
  if (!res.ok) throw new ApiError(`RPC ${path} → ${res.status}`, res.status);
  return (await res.json()) as T;
}

/**
 * Query the Go REST API. It runs on a free dyno that can cold-start, so retry
 * with a gap — but only when it's the source we're actually relying on.
 */
async function viaRest<T>(path: string, revalidate: number, attempts: number, timeoutMs = 12_000): Promise<T> {
  let lastErr: unknown = new ApiError(`API ${path} unavailable`, 0);
  for (let i = 0; i < attempts; i++) {
    const t = withTimeout(undefined, timeoutMs);
    try {
      const res = await fetch(`${BASE}/api/v1${path}`, {
        next: { revalidate },
        signal: t.signal,
      });
      // A 404 is an answer, not an outage: don't retry it and don't mark the
      // API down for it.
      if (res.status === 404) throw new ApiError(`API ${path} → 404`, 404);
      if (!res.ok) throw new ApiError(`API ${path} → ${res.status}`, res.status);
      restDownUntil = 0;
      return (await res.json()) as T;
    } catch (e) {
      if (isNotFound(e)) throw e;
      lastErr = e instanceof ApiError ? e : new ApiError(`API ${path} failed: ${(e as Error)?.message}`, 0);
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 2500));
    } finally {
      t.done();
    }
  }
  throw lastErr;
}

async function getUncached<T>(path: string, revalidate: number, timeoutMs?: number, attempts = 3): Promise<T> {
  const canRpc = rpcEnabled() && route(path) !== null;

  if (canRpc && rpcPrimary()) {
    try {
      return await viaRpc<T>(path, revalidate, timeoutMs);
    } catch {
      // Supabase is down or the function is missing. The REST API may still be
      // up; give it one quick try rather than rendering an error.
      return await viaRest<T>(path, revalidate, 1, timeoutMs ?? 6_000);
    }
  }

  // REST-first: either Supabase isn't configured (local dev), this path has no
  // RPC mapping, or NEXT_PUBLIC_API_PRIMARY=rest was set deliberately.
  try {
    return await viaRest<T>(path, revalidate, canRpc && restDownUntil > Date.now() ? 0 : attempts, timeoutMs);
  } catch (err) {
    if (!canRpc || isNotFound(err)) throw err;
    restDownUntil = Date.now() + PRIMARY_RETRY_MS;
    return await viaRpc<T>(path, revalidate, timeoutMs);
  }
}

// One upstream call per path per server render: generateMetadata and the page
// both ask for the same entity, and so do sibling components. React's cache()
// is request-scoped on the server and a plain call-through in the browser.
const getCached = cache(getUncached) as typeof getUncached;

function get<T>(path: string, revalidate = 300, opts: GetOpts = {}): Promise<T> {
  return getCached<T>(path, revalidate, opts.timeoutMs, opts.attempts);
}

/**
 * Fetch a single entity. Resolves `null` when it doesn't exist (the RPC returns
 * SQL NULL, the REST API returns 404) and rejects only when no backend could
 * answer — so a page can 404 on the first and show a retryable error on the
 * second.
 */
async function getOne<T>(path: string, revalidate = 300): Promise<T | null> {
  try {
    return (await get<T | null>(path, revalidate)) ?? null;
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
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
  launch_year?: number | null;
  outcome: string;
  rocket_id: string | null;
  rocket_slug: string | null;
  rocket_name: string | null;
  agency_id: string | null;
  agency_name: string | null;
  agency_abbrev?: string | null;
  agency_slug?: string | null;
  site_name?: string | null;
  mission_type?: string | null;
  mission_description?: string | null;
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
  /** Small rendition for cards; absent until the database is migrated. */
  thumbnail_url?: string | null;
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

export interface Tle {
  tle_line1?: string;
  tle_line2?: string;
  captured_at?: string;
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

/** Pipeline freshness: when data last changed, and whether the last run was clean. */
export interface SyncStatus {
  last_run_at: string | null;
  last_run_status: string | null;
  last_success_at: string | null;
}

export interface Overview {
  satellites: number;
  rockets: number;
  agencies: number;
  launches: number;
  launch_sites: number;
  years: number;
}

export const api = {
  timelineYears: () => get<YearSummary[]>("/timeline/years"),
  rocketArticles: (id: string) => get<Article[]>(`/rockets/${id}/articles`, 600),
  satelliteArticles: (id: string) => get<Article[]>(`/satellites/${id}/articles`, 600),
  rocketPayloads: (id: string) => get<Satellite[]>(`/rockets/${id}/payloads`),
  launch: (id: string) => getOne<Record<string, any>>(`/launches/${id}`),
  intelSpaceWeather: () => get<Record<string, any> | null>("/intel/spaceweather", 300),
  intelEvents: () => get<any[]>("/intel/events", 300),
  intelConjunctions: () => get<any[]>("/intel/conjunctions", 300),
  intelReentries: () => get<any[]>("/intel/reentries", 300),
  onThisDay: (limit = 10) => get<LaunchRow[]>(`/timeline/on-this-day?limit=${limit}`, 3600),
  timelineYear: (year: number) => get<LaunchRow[]>(`/timeline/years/${year}`),
  upcoming: (limit = 4) => get<LaunchRow[]>(`/launches/upcoming?limit=${limit}`, 60),
  failures: (limit = 100, offset = 0) => get<LaunchRow[]>(`/launches/failures?limit=${limit}&offset=${offset}`, 60),
  agencies: () => get<Agency[]>("/agencies"),
  agency: (id: string) => getOne<Record<string, any>>(`/agencies/${id}`),
  rockets: (q = "") =>
    get<Rocket[]>(`/rockets?limit=1000${q ? `&q=${encodeURIComponent(q)}` : ""}`),
  rocket: (id: string) => getOne<Record<string, any>>(`/rockets/${id}`),
  satellites: (q = "") =>
    get<Satellite[]>(`/satellites${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  satellite: (id: string) => getOne<Record<string, any>>(`/satellites/${id}`),
  /** Filtered page of the catalogue; `qs` is a ready-made query string. */
  satelliteList: (qs: string) => get<Satellite[]>(`/satellites?${qs}`, 300),
  // Newest element set; TLEs refresh every few hours, so an hour of cache is fine.
  satelliteTle: (id: string) => getOne<Tle>(`/satellites/${id}/tle`, 3600),
  // Full slug list (26k+) — sitemap only; cached a day.
  satelliteSlugs: () => get<{ slug: string }[]>("/satellites/slugs", 86400),
  constellation: (name: string) => get<Satellite[]>(`/constellations/${encodeURIComponent(name)}`),
  constellations: () => get<{ name: string; count: number }[]>("/constellations"),
  syncLogs: (limit = 50) => get<SyncLog[]>(`/sync-logs?limit=${limit}`, 5),
  stats: () => get<Overview | null>("/stats/overview", 300),
  search: (q: string) => get<{ kind: "rocket" | "satellite" | "agency"; slug: string; name: string }[]>(`/search?q=${encodeURIComponent(q)}`, 300),
  /**
   * Freshness for the "data refreshed" indicator. Decorative, so it gets a
   * short timeout and never blocks a render for long. Prefers the dedicated
   * RPC; older databases only have the REST sync log, which we reduce to the
   * same shape.
   */
  syncStatus: async (): Promise<SyncStatus | null> => {
    const quick = { timeoutMs: 2_500, attempts: 1 };
    try {
      return await get<SyncStatus | null>("/sync-status", 300, quick);
    } catch {
      // The REST endpoint answers {total, data} (older builds: a bare array).
      const res = await get<SyncLog[] | { data?: SyncLog[] }>("/sync-logs?limit=1", 300, quick);
      const last = Array.isArray(res) ? res[0] : res?.data?.[0];
      return last
        ? {
            last_run_at: last.timestamp,
            last_run_status: last.status,
            last_success_at: last.status === "success" ? last.timestamp : null,
          }
        : null;
    }
  },
};

/** UUIDs are the only valid launch ids; anything else can 404 without a query. */
export const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

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
