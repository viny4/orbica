import Link from "next/link";
import { api } from "@/lib/api";
import { safe } from "@/components/EmptyState";
import { PageHeader, Chip, tileClass } from "@/components/ui";
import { Flag } from "@/components/Flag";

export const metadata = { title: "Satellite Constellations — Orbica" };

interface ConstellationDetail {
  displayName: string;
  operator: string;
  description: string;
  orbitType: string;
  countryCode: string;
}

const CONST_DETAILS: Record<string, ConstellationDetail> = {
  starlink: {
    displayName: "Starlink",
    operator: "SpaceX",
    description: "Global low Earth orbit satellite constellation providing high-speed, low-latency broadband internet access to remote and underserved areas.",
    orbitType: "LEO",
    countryCode: "US",
  },
  oneweb: {
    displayName: "OneWeb",
    operator: "Eutelsat OneWeb",
    description: "Commercial communications network delivering high-speed internet connectivity to enterprise, maritime, aviation, and government customers globally.",
    orbitType: "LEO",
    countryCode: "GB",
  },
  iridium: {
    displayName: "Iridium",
    operator: "Iridium Communications",
    description: "Famous cross-linked satellite system providing worldwide L-band voice and data communication coverage, including complete polar coverage.",
    orbitType: "LEO",
    countryCode: "US",
  },
  gps: {
    displayName: "GPS",
    operator: "US Space Force",
    description: "The primary Global Positioning System offering highly accurate, continuous positioning, navigation, and timing services worldwide.",
    orbitType: "MEO",
    countryCode: "US",
  },
  galileo: {
    displayName: "Galileo",
    operator: "ESA / European Union",
    description: "Europe's independent global navigation satellite system, providing high-precision civil positioning, search and rescue, and timing services.",
    orbitType: "MEO",
    countryCode: "EU",
  },
  globalstar: {
    displayName: "Globalstar",
    operator: "Globalstar, Inc.",
    description: "Low Earth Orbit satellite network supporting commercial asset tracking, mobile voice/data services, and Apple emergency SOS messaging.",
    orbitType: "LEO",
    countryCode: "US",
  },
  orbcomm: {
    displayName: "Orbcomm",
    operator: "Orbcomm Inc.",
    description: "Industrial IoT satellite constellation providing machine-to-machine (M2M) communications, asset tracking, and telematics services.",
    orbitType: "LEO",
    countryCode: "US",
  },
  beidou: {
    displayName: "BeiDou",
    operator: "CNSA / China",
    description: "China's global satellite navigation system offering high-accuracy positioning, timing, and short-message text communication capabilities.",
    orbitType: "MEO / GEO",
    countryCode: "CN",
  },
  kuiper: {
    displayName: "Project Kuiper",
    operator: "Amazon",
    description: "Amazon's upcoming low Earth orbit constellation designed to increase global broadband access through high-speed, low-latency connectivity.",
    orbitType: "LEO",
    countryCode: "US",
  },
};

export default async function ConstellationsIndexPage() {
  const list = await safe(api.constellations(), []);

  // Format and merge database counts with our curated metadata
  const constellations = list.map((item) => {
    const key = item.name.toLowerCase();
    const curated = CONST_DETAILS[key];

    return {
      slug: key,
      name: item.name,
      count: item.count,
      displayName: curated?.displayName || item.name,
      operator: curated?.operator || "Various Operators",
      description: curated?.description || "Active satellite constellation network.",
      orbitType: curated?.orbitType || "LEO",
      countryCode: curated?.countryCode || "",
    };
  });

  return (
    <div>
      <PageHeader
        eyebrow="Mega-Networks"
        title="Satellite Constellations"
        meta={`${constellations.length} global satellite networks currently operational or deploying`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5">
        {constellations.map((c) => (
          <Link
            key={c.slug}
            href={`/constellations/${encodeURIComponent(c.slug)}`}
            className={tileClass}
          >
            <div className="flex flex-col justify-between h-full min-h-[175px]">
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--color-space-accent-2)]">
                    {c.orbitType}
                  </span>
                  <span className="text-[11px] font-mono text-white/50 shrink-0">
                    {c.count.toLocaleString()} satellites
                  </span>
                </div>
                
                <h2 className="font-light text-xl leading-tight text-white group-hover:text-[var(--color-space-accent-2)] transition-colors">
                  {c.displayName}
                </h2>
                
                <p className="mt-3 text-xs text-white/45 leading-relaxed font-light line-clamp-3">
                  {c.description}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <span className="text-[11px] text-white/55 font-mono flex items-center gap-1.5 truncate pr-2">
                  {c.countryCode && <Flag code={c.countryCode} className="w-3.5 h-2.5 rounded-[1px] shrink-0" />}
                  <span className="truncate">{c.operator}</span>
                </span>
                
                <span className="text-[10px] tracking-widest uppercase text-[var(--color-space-accent-2)]/80 group-hover:text-[var(--color-space-accent-2)] transition-colors shrink-0">
                  Track →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
