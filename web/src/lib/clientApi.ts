// Client-side fetch for the Orbica API.
//
// Relative "/api/*" URLs ride a Next rewrite through the site's own origin.
// That's convenient in dev, but in production it adds a proxy hop that has been
// measured at 30s+ when the API dyno is cold — while going direct answers in
// ~1s. Browser code must use this helper instead of relative fetches.
//
// Supabase answers first when it's configured; the Go API is the fallback and
// the only source in local development. See rpc.ts for why that order.
import { rpcEnabled, rpcPrimary, rpcFetch, route, withTimeout } from "./rpc";

const BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";

const PRIMARY_RETRY_MS = 60_000;
const REST_TIMEOUT_MS = 12_000;
let restDownUntil = 0;

const isAbort = (e: unknown) => (e as Error)?.name === "AbortError";

async function viaRest(path: string, init: RequestInit | undefined, attempts: number) {
  const url = `${BASE}${path}`; // BASE unset (plain dev) → relative, rewrite handles it
  let lastErr: unknown = new Error(`API ${path} unavailable`);
  for (let i = 0; i < attempts; i++) {
    // Keep the caller's signal (a superseded search must cancel the request),
    // and add our timeout on top of it.
    const t = withTimeout(init?.signal ?? undefined, REST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: t.signal });
      // Retry server errors too — a waking dyno can 502 briefly.
      if (res.status >= 500) throw new Error(`API ${path} → ${res.status}`);
      restDownUntil = 0;
      return res;
    } catch (e) {
      if (isAbort(e) && init?.signal?.aborted) throw e; // the caller gave up — stop
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1500));
    } finally {
      t.done();
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
    } catch (e) {
      if (signal?.aborted) throw e;
      /* fall through to the REST API */
    }
    return viaRest(path, init, 1);
  }

  try {
    return await viaRest(path, init, canRpc && restDownUntil > Date.now() ? 0 : 3);
  } catch (err) {
    if (!canRpc || signal?.aborted) throw err;
    restDownUntil = Date.now() + PRIMARY_RETRY_MS;
    return rpcFetch(rpcPath, { signal });
  }
}

// ── Cached JSON reads ────────────────────────────────────────────────────────
//
// Catalogue data changes every few hours, so re-asking for the same filter
// combination, search term or entity within a few minutes is pure waste — and
// typing "starl", backspacing and retyping it used to fire it twice. Identical
// concurrent requests share one fetch; results are reused for `ttlMs`.

type Entry = { expires: number; promise: Promise<unknown> };
const store = new Map<string, Entry>();
const MAX_ENTRIES = 200;

/**
 * GET + parse JSON, deduplicated and briefly cached. The shared request is not
 * tied to any one caller: aborting `signal` rejects this call immediately (so a
 * stale search result can never land) without cancelling the fetch for others.
 */
export function apiJSON<T>(
  path: string,
  { signal, ttlMs = 5 * 60_000 }: { signal?: AbortSignal; ttlMs?: number } = {},
): Promise<T> {
  const now = Date.now();
  let entry = store.get(path);
  if (!entry || entry.expires <= now) {
    const promise = apiFetch(path).then(async (res) => {
      if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
      return res.json();
    });
    entry = { expires: now + ttlMs, promise };
    store.set(path, entry);
    // Failures must not be cached — the next caller should retry.
    promise.catch(() => {
      if (store.get(path) === entry) store.delete(path);
    });
    if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string);
  }

  const shared = entry.promise as Promise<T>;
  if (!signal) return shared;
  if (signal.aborted) return Promise.reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    shared.then(
      (v) => {
        signal.removeEventListener("abort", onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener("abort", onAbort);
        reject(e);
      },
    );
  });
}

export { isAbort };
