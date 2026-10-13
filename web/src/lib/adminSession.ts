// Signed admin session tokens (edge-compatible: Web Crypto only).
//
// The old cookie was the literal string "authenticated", so anyone could set it
// by hand and walk into /sync-logs. A session is now `v1.<expiryMs>.<sig>`,
// where sig = HMAC-SHA256(secret, "v1.<expiryMs>"): it can't be forged without
// the secret and stops working at expiry.
//
// Secret: ADMIN_SESSION_SECRET, or — so existing deployments keep working with
// no new variable — a key derived from ADMIN_PASSWORD (changing the password
// then also signs everyone out, which is what you'd want).

const enc = new TextEncoder();
export const SESSION_COOKIE = "admin_session";
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function secret(): string | null {
  const s = process.env.ADMIN_SESSION_SECRET || (process.env.ADMIN_PASSWORD ? `orbica-admin:${process.env.ADMIN_PASSWORD}` : "");
  return s || null;
}

function b64url(buf: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}

/** Length-independent string comparison (no early exit on first mismatch). */
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function createSession(now = Date.now()): Promise<string | null> {
  const key = secret();
  if (!key) return null;
  const payload = `v1.${now + SESSION_TTL_MS}`;
  return `${payload}.${await hmac(key, payload)}`;
}

export async function verifySession(token: string | undefined, now = Date.now()): Promise<boolean> {
  const key = secret();
  if (!key || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const expiry = Number(parts[1]);
  if (!Number.isFinite(expiry) || expiry <= now) return false;
  return safeEqual(parts[2], await hmac(key, `${parts[0]}.${parts[1]}`));
}

/**
 * Compare submitted credentials against the configured ones without leaking
 * where they differ through timing (both sides are hashed to equal length).
 */
export async function credentialsMatch(username: string, password: string): Promise<boolean> {
  const u = process.env.ADMIN_USERNAME;
  const p = process.env.ADMIN_PASSWORD;
  if (!u || !p) return false;
  const key = "orbica-credential-compare";
  const [a, b, c, d] = await Promise.all([hmac(key, username), hmac(key, u), hmac(key, password), hmac(key, p)]);
  return safeEqual(a, b) && safeEqual(c, d);
}

/**
 * Only same-site relative paths may be used as post-login redirects; anything
 * else (absolute URLs, protocol-relative //evil.com, backslash tricks) falls
 * back to the default. Prevents the login form being used as an open redirect.
 */
export function safeCallback(raw: string | null | undefined, fallback = "/sync-logs"): string {
  if (!raw || typeof raw !== "string") return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\") || /[\r\n]/.test(raw)) return fallback;
  return raw;
}
