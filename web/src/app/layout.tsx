import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import GlobalSearch from "@/components/GlobalSearch";
import MobileNav from "@/components/MobileNav";
import SiteNav from "@/components/SiteNav";
import HeaderFrame from "@/components/HeaderFrame";
import SiteFooter from "@/components/SiteFooter";
import RevealObserver from "@/components/RevealObserver";
import { OrbicaMark } from "@/components/OrbicaMark";
import AnalyticsTracker from "@/components/track/AnalyticsTracker";
import { JsonLd, websiteSchema } from "@/components/JsonLd";

// Display + body: Space Grotesk (geometric, space-themed). Telemetry: JetBrains Mono.
// Both are variable fonts, self-hosted by next/font (no third-party request).
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap" });

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

export const viewport: Viewport = {
  themeColor: "#03050a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

// Runs before first paint: marks the document as JS-capable so scroll-reveal
// styles only ever hide content for browsers that will reveal it again.
const JS_FLAG = "document.documentElement.classList.add('js')";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: JS_FLAG }} />
      </head>
      <body className="font-sans antialiased">
        <a
          href="#main"
          className="sr-only z-[200] bg-accent px-4 py-2 font-mono text-xs uppercase tracking-widest text-void focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <JsonLd data={websiteSchema()} />
        <AnalyticsTracker />
        <RevealObserver />

        <HeaderFrame>
          <div className="shell flex h-16 items-center justify-between gap-4">
            <Link href="/" className="group flex items-center gap-2.5 text-ink" aria-label="Orbica home">
              <OrbicaMark className="h-[22px] w-[22px] text-accent transition-transform duration-500 group-hover:rotate-[24deg]" />
              <span className="text-[13px] font-semibold uppercase tracking-[0.32em]">Orbica</span>
            </Link>
            <div className="flex items-center gap-3 sm:gap-5 lg:gap-9">
              <SiteNav />
              <GlobalSearch />
              <MobileNav />
            </div>
          </div>
        </HeaderFrame>

        <main id="main" tabIndex={-1} className="outline-none">
          {children}
        </main>

        <SiteFooter />
      </body>
    </html>
  );
}
