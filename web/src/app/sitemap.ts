import type { MetadataRoute } from "next";
import { api } from "@/lib/api";
import { safe } from "@/components/EmptyState";

export const revalidate = 86400; // rebuild the sitemap daily

const BASE = "https://orbica.space";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    "", "/upcoming", "/timeline", "/agencies", "/rockets", "/satellites", "/track", "/intel", "/search",
  ].map((p) => ({ url: `${BASE}${p}`, changeFrequency: "daily", priority: p === "" ? 1 : 0.8 }));

  const [rockets, agencies, years, satSlugs] = await Promise.all([
    safe(api.rockets(), []),
    safe(api.agencies(), []),
    safe(api.timelineYears(), []),
    // The satellite pages are the long-tail: 26k+ URLs people search by name
    // (Starlink-XXXX, NORAD ids). Without them the sitemap hides ~96% of the site.
    safe(api.satelliteSlugs(), []),
  ]);

  const rocketUrls: MetadataRoute.Sitemap = rockets
    .filter((r) => r.slug)
    .map((r) => ({ url: `${BASE}/rockets/${r.slug}`, changeFrequency: "weekly", priority: 0.6 }));
  const agencyUrls: MetadataRoute.Sitemap = agencies
    .filter((a) => a.slug)
    .map((a) => ({ url: `${BASE}/agencies/${a.slug}`, changeFrequency: "monthly", priority: 0.5 }));
  const yearUrls: MetadataRoute.Sitemap = years.map((y) => ({
    url: `${BASE}/timeline/${y.launch_year}`, changeFrequency: "monthly", priority: 0.4,
  }));
  const satUrls: MetadataRoute.Sitemap = satSlugs
    .filter((s) => s.slug)
    .map((s) => ({ url: `${BASE}/satellites/${s.slug}`, changeFrequency: "weekly", priority: 0.5 }));

  return [...staticRoutes, ...rocketUrls, ...agencyUrls, ...yearUrls, ...satUrls];
}
