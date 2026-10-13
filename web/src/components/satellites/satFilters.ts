// Shared by the server page (initial render) and the client browser — kept out
// of the "use client" module so the server can call these helpers.

export interface Sat {
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
  launch_year: number | null;
  image_url: string | null;
}

export interface SatFilters {
  purpose: string;
  orbit: string;
  status: string;
  type: string;
  q: string;
}

export const PAGE_SIZE = 60;

/** API query string (limit/offset + filters). */
export function filterQuery(f: SatFilters, offset = 0): string {
  const p = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (offset) p.set("offset", String(offset));
  if (f.purpose) p.set("purpose", f.purpose);
  if (f.orbit) p.set("orbit_type", f.orbit);
  if (f.status) p.set("status", f.status);
  if (f.type) p.set("object_type", f.type);
  if (f.q.trim()) p.set("q", f.q.trim());
  return p.toString();
}

/** Shareable page URL for a filter set (payloads are the default type). */
export function pageUrl(f: SatFilters): string {
  const p = new URLSearchParams();
  if (f.purpose) p.set("purpose", f.purpose);
  if (f.orbit) p.set("orbit", f.orbit);
  if (f.status) p.set("status", f.status);
  if (f.type !== "PAY") p.set("type", f.type || "all");
  if (f.q.trim()) p.set("q", f.q.trim());
  const s = p.toString();
  return s ? `/satellites?${s}` : "/satellites";
}
