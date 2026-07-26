// Structured data (schema.org JSON-LD) so search engines understand pages and
// can show rich results (breadcrumbs in listings, a sitelinks search box).

const BASE = "https://orbica.space";

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON-LD must be raw JSON inside a script tag; escape `<` to keep any
      // data-derived string from closing the tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

// Site-wide schema: identifies Orbica + tells Google the site has search.
export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Orbica",
    url: BASE,
    description:
      "Encyclopedia of every rocket and satellite launched since 1957, with live 3D orbit tracking.",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${BASE}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

// Breadcrumb trail for a detail page, e.g. Home > Satellites > ISS (ZARYA).
export function breadcrumbSchema(crumbs: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${BASE}${c.path}`,
    })),
  };
}
