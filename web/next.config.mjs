/** @type {import('next').NextConfig} */

const origin = (u) => {
  try {
    return u ? new URL(u).origin : "";
  } catch {
    return "";
  }
};
const api = origin(process.env.NEXT_PUBLIC_API_URL);
const supabase = origin(process.env.NEXT_PUBLIC_SUPABASE_URL);
const analytics = origin(process.env.NEXT_PUBLIC_ANALYTICS_URL);
const ws = api.replace(/^http/, "ws");

// Enforced now: directives that can't break legitimate features — no framing
// (clickjacking), no <base> hijack, no plugins, forms post only to us.
const CSP_ENFORCED = ["frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'", "form-action 'self'"].join("; ");

// The full allow-list ships report-only first: inline scripts are required by
// Next's RSC payload (a nonce would need middleware on every route), and a
// missed origin would otherwise silently break the tracker or embeds.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${[api, ws, supabase, analytics].filter(Boolean).join(" ")} https://nominatim.openstreetmap.org https://api.bigdatacloud.net`,
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  // No includeSubDomains/preload: that would commit every subdomain to HTTPS
  // permanently, which should be a deliberate decision, not a side effect.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Geolocation stays available to our own pages (pass predictions, "near me").
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)" },
  { key: "Content-Security-Policy", value: CSP_ENFORCED },
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // next/image isn't used (images are third-party CDN URLs rendered with <img>,
  // and Cloudflare Pages has no optimizer). The previous `hostname: "**"`
  // pattern would have turned /_next/image into an open image proxy.
  images: { unoptimized: true },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Static textures are content-stable; let browsers and the CDN keep them.
      { source: "/textures/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }] },
    ];
  },
  async rewrites() {
    // Proxy API calls in dev so the browser can hit /api/* same-origin.
    const target = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
};

export default nextConfig;
