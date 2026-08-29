// Client-side fetch for the Orbica API.
//
// Relative "/api/*" URLs ride a Next rewrite through the site's own origin.
// That's convenient in dev, but in production it adds a proxy hop that has been
// measured at 30s+ when the API dyno is cold — while calling the API origin
// directly answers in ~1s. Browser code must use this helper instead of
// relative fetches: direct URL, 12s timeout, and retries to absorb cold starts.
//
// If the API is unreachable and Supabase RPC is configured, the same query is
// served from Postgres instead, so the site keeps working through an outage.
import { rpcEnabled, rpcFetch, route } from "./rpc";

const BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";

const PRIMARY_RETRY_MS = 60_000;
let primaryDownUntil = 0;

/** `path` is the full "/api/v1/..." path used by the REST API. */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${BASE}${path}`; // BASE unset (plain dev) → relative, rewrite handles it
  const rpcPath = path.replace(/^\/api\/v1/, "");
  const canFallBack = rpcEnabled() && route(rpcPath) !== null;
  // Skip the primary while it's known-down so an outage doesn't cost a timeout
  // on every request.
  const attempts = canFallBack && primaryDownUntil > Date.now() ? 0 : 3;

  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
      // Retry server errors too — a waking dyno can 502 briefly.
      if (res.status >= 500) throw new Error(`API ${path} → ${res.status}`);
      primaryDownUntil = 0;
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt < attempts - 1) await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // Primary unreachable: serve the same query from Supabase RPC.
  if (canFallBack) {
    if (attempts > 0) primaryDownUntil = Date.now() + PRIMARY_RETRY_MS;
    return rpcFetch(rpcPath, init?.signal ?? undefined);
  }
  throw lastErr;
}
