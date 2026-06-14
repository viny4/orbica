import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://orbica.space/sitemap.xml",
    host: "https://orbica.space",
  };
}
