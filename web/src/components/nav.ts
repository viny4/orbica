// Single source of truth for site navigation. Desktop renders the groups as
// dropdowns; mobile renders the same groups as labelled sections.

export type NavItem = { label: string; href: string; description?: string };
export type NavEntry =
  | { label: string; href: string; items?: undefined }
  | { label: string; items: NavItem[]; href?: undefined };

export const NAV: NavEntry[] = [
  { label: "ISS Live", href: "/iss" },
  { label: "Track", href: "/track" },
  {
    label: "Encyclopedia",
    items: [
      { label: "Rockets", href: "/rockets", description: "Every launch vehicle, in 3D" },
      { label: "Satellites", href: "/satellites", description: "26,000+ catalogued objects" },
      { label: "Constellations", href: "/constellations", description: "Starlink, GPS, OneWeb…" },
      { label: "Agencies", href: "/agencies", description: "Operators by nation" },
      { label: "Compare", href: "/compare", description: "Vehicles side by side" },
    ],
  },
  {
    label: "Launches",
    items: [
      { label: "Upcoming", href: "/upcoming", description: "Live countdowns" },
      { label: "Timeline", href: "/timeline", description: "1957 to today, by year" },
      { label: "On this day", href: "/on-this-day", description: "Launches on today's date" },
      { label: "Failures", href: "/failures", description: "The anomaly archive" },
    ],
  },
  { label: "Intel", href: "/intel" },
];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
