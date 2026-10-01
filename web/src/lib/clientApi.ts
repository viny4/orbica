// Client-side fetch for the Orbica API.
//
// Relative "/api/*" URLs ride a Next rewrite through the site's own origin.
// That's convenient in dev, but in production it adds a proxy hop that has been
// measured at 30s+ when the API dyno is cold — while going direct answers in
// ~1s. Browser code must use this helper instead of relative fetches.
//
// Supabase answers first when it's configured; the Go API is the fallback and
// the only source in local development. See rpc.ts for why that order.
import { rpcEnabled, rpcPrimary, rpcFetch, route } from "./rpc";

const BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";

const PRIMARY_RETRY_MS = 60_000;
let restDownUntil = 0;

async function viaRest(path: string, init: RequestInit | undefined, attempts: number) {
  const url = `${BASE}${path}`; // BASE unset (plain dev) → relative, rewrite handles it
  let lastErr: unknown = new Error(`API ${path} unavailable`);
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
      // Retry server errors too — a waking dyno can 502 briefly.
      if (res.status >= 500) throw new Error(`API ${path} → ${res.status}`);
      restDownUntil = 0;
      return res;
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr;
}

/** `path` is the full "/api/v1/..." path used by the REST API. */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const rpcPath = path.replace(/^\/api\/v1/, "");
  const canRpc = rpcEnabled() && route(rpcPath) !== null;
  const signal = init?.signal ?? undefined;

  if (canRpc && rpcPrimary()) {
    try {
      const res = await rpcFetch(rpcPath, { signal });
      if (res.ok) return res;
    } catch {
      /* fall through to the REST API */
    }
    return viaRest(path, init, 1);
  }

  try {
    return await viaRest(path, init, canRpc && restDownUntil > Date.now() ? 0 : 3);
  } catch (err) {
    if (!canRpc) throw err;
    restDownUntil = Date.now() + PRIMARY_RETRY_MS;
    return rpcFetch(rpcPath, { signal });
  }
}
