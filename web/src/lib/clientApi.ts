// Client-side fetch for the Orbica API.
//
// Relative "/api/*" URLs ride a Next rewrite through the site's own origin.
// That's convenient in dev, but in production it adds a proxy hop that has been
// measured at 30s+ when the API dyno is cold — while calling the API origin
// directly answers in ~1s. Browser code must use this helper instead of
// relative fetches: direct URL, 12s timeout, and retries to absorb cold starts.
const BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${BASE}${path}`; // BASE unset (plain dev) → relative, rewrite handles it
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
      // Retry server errors too — a waking dyno can 502 briefly.
      if (res.status >= 500) throw new Error(`API ${path} → ${res.status}`);
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr;
}
