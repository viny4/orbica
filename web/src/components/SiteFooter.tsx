import Link from "next/link";
import { OrbicaMark } from "@/components/OrbicaMark";

// Site-wide footer: the full map of the product (so every section is two
// clicks from anywhere) and credit to the open data sources Orbica is built on.
// Several of those sources ask for attribution as a condition of use.

const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: "Live",
    links: [
      ["ISS tracker", "/iss"],
      ["Satellite tracker", "/track"],
      ["Upcoming launches", "/upcoming"],
      ["Space intelligence", "/intel"],
    ],
  },
  {
    title: "Encyclopedia",
    links: [
      ["Rockets", "/rockets"],
      ["Satellites", "/satellites"],
      ["Constellations", "/constellations"],
      ["Agencies", "/agencies"],
      ["Compare vehicles", "/compare"],
    ],
  },
  {
    title: "Archive",
    links: [
      ["Timeline", "/timeline"],
      ["On this day", "/on-this-day"],
      ["Launch failures", "/failures"],
      ["Search", "/search"],
    ],
  },
];

const SOURCES: [string, string][] = [
  ["Launch Library 2", "https://thespacedevs.com/llapi"],
  ["CelesTrak", "https://celestrak.org"],
  ["Spaceflight News API", "https://spaceflightnewsapi.net"],
  ["Space-Track", "https://www.space-track.org"],
  ["UCS Satellite Database", "https://www.ucs.org/resources/satellite-database"],
  ["ESA DISCOS", "https://discosweb.esoc.esa.int"],
  ["Wikipedia & Wikidata", "https://www.wikidata.org"],
  ["NOAA SWPC", "https://www.swpc.noaa.gov"],
];

export default function SiteFooter() {
  return (
    <footer className="relative mt-24 border-t border-line bg-void">
      <div className="shell grid gap-12 py-16 md:grid-cols-[1.3fr_repeat(3,1fr)]">
        <div className="max-w-sm">
          <Link href="/" className="inline-flex items-center gap-3 text-ink" aria-label="Orbica home">
            <OrbicaMark className="h-6 w-6 text-accent" />
            <span className="text-[13px] font-semibold uppercase tracking-[0.32em]">Orbica</span>
          </Link>
          <p className="mt-5 text-sm leading-relaxed text-ink-3">
            An open record of every rocket and satellite launched since 1957 — with live orbits
            propagated from the latest public element sets.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-4">{col.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {col.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-ink-2 transition-colors hover:text-accent">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="shell flex flex-col gap-4 py-6 text-[11px] leading-relaxed text-ink-4 md:flex-row md:items-center md:justify-between">
          <p className="max-w-3xl">
            Data:{" "}
            {SOURCES.map(([name, url], i) => (
              <span key={name}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:text-ink-2 hover:underline">
                  {name}
                </a>
                {i < SOURCES.length - 1 ? " · " : ""}
              </span>
            ))}
            . Images remain the property of their credited owners.
          </p>
          <p className="shrink-0 font-mono uppercase tracking-[0.2em]">© {new Date().getFullYear()} Orbica</p>
        </div>
      </div>
    </footer>
  );
}
