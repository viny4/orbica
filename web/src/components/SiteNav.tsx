"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Desktop navigation. Eleven flat links read as a train, so the nav keeps only
// the destinations (ISS, Track) top-level and groups the rest under two menus.
// Dropdowns are CSS-driven (hover + focus-within) so no JS state is needed, and
// stay keyboard-accessible. Mobile keeps the flat overlay menu (MobileNav).

type Item = { label: string; href: string };
type Entry =
  | { label: string; href: string; items?: undefined }
  | { label: string; items: Item[]; href?: undefined };

const NAV: Entry[] = [
  { label: "ISS Live", href: "/iss" },
  { label: "Track", href: "/track" },
  {
    label: "Encyclopedia",
    items: [
      { label: "Rockets", href: "/rockets" },
      { label: "Satellites", href: "/satellites" },
      { label: "Agencies", href: "/agencies" },
      { label: "Compare", href: "/compare" },
    ],
  },
  {
    label: "Launches",
    items: [
      { label: "Upcoming", href: "/upcoming" },
      { label: "Timeline", href: "/timeline" },
      { label: "Failures", href: "/failures" },
    ],
  },
  { label: "Intel", href: "/intel" },
];

const linkBase = "text-[11px] tracking-[0.22em] uppercase transition-colors";

function TopLink({ href, label, active }: Item & { active: boolean }) {
  return (
    <Link
      href={href}
      className={`${linkBase} ${active ? "text-white" : "text-white/70 hover:text-white"}`}
    >
      {label}
    </Link>
  );
}

export default function SiteNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="hidden md:flex items-center gap-8">
      {NAV.map((entry) =>
        entry.items ? (
          <div key={entry.label} className="relative group">
            <button
              type="button"
              className={`${linkBase} flex items-center gap-1.5 ${
                entry.items.some((i) => isActive(i.href))
                  ? "text-white"
                  : "text-white/70 group-hover:text-white group-focus-within:text-white"
              }`}
              aria-haspopup="true"
            >
              {entry.label}
              <svg width="8" height="8" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            {/* pt-4 bridges the hover gap between trigger and panel */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full pt-4 hidden group-hover:block group-focus-within:block">
              <div className="min-w-[180px] border border-white/10 bg-[#0a0f1c]/95 backdrop-blur-xl py-2 shadow-2xl shadow-black/60">
                {entry.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block px-5 py-2.5 ${linkBase} ${
                      isActive(item.href)
                        ? "text-white bg-white/5"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <TopLink key={entry.href} href={entry.href} label={entry.label} active={isActive(entry.href)} />
        ),
      )}
    </div>
  );
}
