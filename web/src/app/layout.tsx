import type { Metadata } from "next";
import Link from "next/link";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import GlobalSearch from "@/components/GlobalSearch";
import MobileNav from "@/components/MobileNav";
import SiteNav from "@/components/SiteNav";
import AnalyticsTracker from "@/components/track/AnalyticsTracker";
import { JsonLd, websiteSchema } from "@/components/JsonLd";

// Display + body: Space Grotesk (geometric, space-themed). Telemetry: JetBrains Mono.
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  metadataBase: new URL("https://orbica.space"),
  title: "Orbica — Every rocket and satellite, 1957 to today",
  description:
    "The complete encyclopedia of every rocket and satellite ever launched (1957–today) — 3D models, live orbit tracking, and computed space intelligence.",
  keywords: ["satellite tracker", "rocket database", "live satellite tracking", "spaceflight", "orbit", "space intelligence", "Orbica"],
  openGraph: {
    title: "Orbica — Every rocket and satellite",
    description:
      "Browse 70 years of spaceflight in interactive 3D, track the live sky in real time, and read computed space intelligence.",
    url: "https://orbica.space",
    siteName: "Orbica",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Orbica — Every rocket and satellite",
    description: "Interactive 3D space encyclopedia + live satellite tracker.",
  },
  alternates: { canonical: "https://orbica.space" },
};

// Flat list for the mobile overlay menu; the desktop nav (SiteNav) groups these.
const NAV = [
  ["ISS Live", "/iss"],
  ["Track", "/track"],
  ["Rockets", "/rockets"],
  ["Satellites", "/satellites"],
  ["Agencies", "/agencies"],
  ["Compare", "/compare"],
  ["Upcoming", "/upcoming"],
  ["Timeline", "/timeline"],
  ["Failures", "/failures"],
  ["Intel", "/intel"],
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`antialiased ${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans`}>
        <JsonLd data={websiteSchema()} />
        <AnalyticsTracker />
        {/* Fixed, transparent header that floats over the hero */}
        <header className="fixed top-0 inset-x-0 z-50">
          <nav className="mx-auto max-w-[1400px] flex items-center justify-between px-6 lg:px-10 h-16">
            <Link
              href="/"
              className="text-[13px] font-semibold tracking-[0.32em] uppercase text-white"
            >
              Orbica
            </Link>
            <div className="flex items-center gap-3 sm:gap-5 md:gap-8">
              <SiteNav />
              <GlobalSearch />
              <MobileNav items={NAV} />
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
