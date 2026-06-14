/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  async rewrites() {
    // Proxy API calls in dev so the browser can hit /api/* same-origin.
    const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
};

export default nextConfig;
