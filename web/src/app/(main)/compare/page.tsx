export const runtime = "edge";
"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { api, type Rocket } from "@/lib/api";
import { PageHeader, Chip } from "@/components/ui";

// Client-only dynamic imports for 3D components to prevent SSR errors
const RocketViewer3D = dynamic(() => import("@/components/rockets/RocketViewer3D"), {
  ssr: false,
  loading: () => (
    <div className="w-full aspect-[2/3] border border-white/5 bg-white/[0.01] grid place-items-center text-white/30 text-xs tracking-widest uppercase">
      Loading 3D model…
    </div>
  ),
});

// Dropdown component for searching and selecting a rocket in a column
interface RocketSelectorProps {
  allRockets: Rocket[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  onClear: () => void;
  columnNumber: number;
}

function RocketSelector({ allRockets, selectedSlug, onSelect, onClear, columnNumber }: RocketSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedRocket = useMemo(() => {
    return allRockets.find((r) => r.slug === selectedSlug) || null;
  }, [allRockets, selectedSlug]);

  const filteredRockets = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return allRockets.slice(0, 10);
    return allRockets
      .filter((r) => r.name.toLowerCase().includes(query))
      .slice(0, 10);
  }, [allRockets, search]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClose = () => setIsOpen(false);
    document.addEventListener("click", handleClose);
    return () => document.removeEventListener("click", handleClose);
  }, [isOpen]);

  if (selectedRocket) {
    return (
      <div className="relative border border-white/10 bg-[#06080f] p-4 flex flex-col justify-between h-[120px] transition-colors hover:border-white/20">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-white/40 block mb-1">
            Vehicle {columnNumber}
          </span>
          <span className="font-light text-base text-white truncate block max-w-[90%]">
            {selectedRocket.name}
          </span>
          {selectedRocket.variant && (
            <span className="text-[11px] font-mono text-white/50 block mt-0.5 truncate">
              {selectedRocket.variant}
            </span>
          )}
        </div>
        <button
          onClick={onClear}
          className="absolute top-3 right-3 text-white/45 hover:text-white transition-colors p-1"
          aria-label="Clear selection"
        >
          ✕
        </button>
        <Link
          href={`/rockets/${selectedRocket.slug}`}
          className="text-[10px] tracking-widest uppercase text-[var(--color-space-accent-2)]/80 hover:text-[var(--color-space-accent-2)] transition-colors mt-2"
        >
          View Specs →
        </Link>
      </div>
    );
  }

  return (
    <div className="relative border border-dashed border-white/10 bg-white/[0.005] hover:bg-white/[0.01] transition-colors p-4 h-[120px] flex flex-col justify-center">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="w-full text-left text-xs tracking-[0.15em] uppercase text-white/50 hover:text-white transition-colors"
      >
        + Add rocket {columnNumber}
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-full left-0 right-0 mt-1 border border-white/15 bg-[#090d16] shadow-xl z-20 max-h-60 overflow-y-auto"
        >
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fleet..."
            className="w-full bg-black/60 border-b border-white/15 px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-b-[var(--color-space-accent-2)]"
            autoFocus
          />
          <ul>
            {filteredRockets.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => {
                    onSelect(r.slug);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-white/75 hover:bg-white/[0.05] hover:text-[var(--color-space-accent-2)] transition-colors flex justify-between"
                >
                  <span className="truncate">{r.name}</span>
                  <span className="text-[10px] font-mono text-white/30 shrink-0 ml-2">
                    {r.variant || r.status || ""}
                  </span>
                </button>
              </li>
            ))}
            {filteredRockets.length === 0 && (
              <li className="px-3 py-2 text-[10px] text-white/30 italic">No matches found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// Side-by-side comparison data rows
interface CompareContentProps {
  allRockets: Rocket[];
}

function CompareContent({ allRockets }: CompareContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Get active slugs from URL parameters
  const selectedSlugs = useMemo(() => {
    return searchParams.getAll("r").slice(0, 3);
  }, [searchParams]);

  // Keep state of fetched full rocket specs
  const [rocketDetails, setRocketDetails] = useState<Record<string, any>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});

  // Fetch full details for selected slugs
  useEffect(() => {
    selectedSlugs.forEach((slug) => {
      if (slug && !rocketDetails[slug] && !loadingDetails[slug]) {
        setLoadingDetails((prev) => ({ ...prev, [slug]: true }));
        api
          .rocket(slug)
          .then((data) => {
            setRocketDetails((prev) => ({ ...prev, [slug]: data }));
            setLoadingDetails((prev) => ({ ...prev, [slug]: false }));
          })
          .catch(() => {
            setLoadingDetails((prev) => ({ ...prev, [slug]: false }));
          });
      }
    });
  }, [selectedSlugs, rocketDetails, loadingDetails]);

  // Update URL params on selection
  const handleSelect = (index: number, slug: string) => {
    const params = new URLSearchParams();
    const current = [...selectedSlugs];
    current[index] = slug;
    current.forEach((s) => params.append("r", s));
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleClear = (index: number) => {
    const params = new URLSearchParams();
    const current = [...selectedSlugs];
    current.splice(index, 1);
    current.forEach((s) => params.append("r", s));
    router.push(`${pathname}?${params.toString()}`);
  };

  const activeRockets = useMemo(() => {
    return selectedSlugs.map((slug) => rocketDetails[slug] || null);
  }, [selectedSlugs, rocketDetails]);

  // Helper values to calculate maximums for proportional comparison bars
  const numericMaxs = useMemo(() => {
    const parse = (arr: (any | null)[], key: string) =>
      arr.map((r) => (r ? parseFloat(r[key] || "0") : 0)).filter((v) => v > 0);

    const heights = parse(activeRockets, "height_m");
    const diameters = parse(activeRockets, "diameter_m");
    const masses = parse(activeRockets, "mass_kg");
    const payloads = parse(activeRockets, "payload_leo_kg");
    const gtos = parse(activeRockets, "payload_gto_kg");

    return {
      height_m: heights.length ? Math.max(...heights) : 0,
      diameter_m: diameters.length ? Math.max(...diameters) : 0,
      mass_kg: masses.length ? Math.max(...masses) : 0,
      payload_leo_kg: payloads.length ? Math.max(...payloads) : 0,
      payload_gto_kg: gtos.length ? Math.max(...gtos) : 0,
    };
  }, [activeRockets]);

  // Spec rows definitions
  const specFields = [
    {
      section: "Overview",
      fields: [
        { label: "Manufacturer", getValue: (r: any) => r.manufacturer?.name || "Unknown" },
        { label: "Country", getValue: (r: any) => r.manufacturer?.country_code || "—" },
        {
          label: "Status",
          getValue: (r: any) => (
            <span className="uppercase text-[10px] tracking-wider font-mono">
              <Chip tone={r.status === "active" ? "accent" : "muted"}>{r.status || "Unknown"}</Chip>
            </span>
          ),
        },
        { label: "Reusability", getValue: (r: any) => (r.reusable ? "Reusable" : "Expendable") },
        { label: "First Flight", getValue: (r: any) => r.first_flight || "—" },
        { label: "Last Flight", getValue: (r: any) => r.last_flight || "—" },
      ],
    },
    {
      section: "Dimensions",
      fields: [
        {
          label: "Height",
          getValue: (r: any) => (r.height_m ? `${r.height_m} m` : "—"),
          barValue: (r: any) => (r.height_m ? parseFloat(r.height_m) : 0),
          maxKey: "height_m" as const,
        },
        {
          label: "Diameter",
          getValue: (r: any) => (r.diameter_m ? `${r.diameter_m} m` : "—"),
          barValue: (r: any) => (r.diameter_m ? parseFloat(r.diameter_m) : 0),
          maxKey: "diameter_m" as const,
        },
        {
          label: "Mass",
          getValue: (r: any) => (r.mass_kg ? `${Number(r.mass_kg).toLocaleString()} kg` : "—"),
          barValue: (r: any) => (r.mass_kg ? parseFloat(r.mass_kg) : 0),
          maxKey: "mass_kg" as const,
        },
        { label: "Stages", getValue: (r: any) => r.stages || "—" },
      ],
    },
    {
      section: "Performance & Propulsion",
      fields: [
        {
          label: "Payload LEO",
          getValue: (r: any) =>
            r.payload_leo_kg ? `${Number(r.payload_leo_kg).toLocaleString()} kg` : "—",
          barValue: (r: any) => (r.payload_leo_kg ? parseFloat(r.payload_leo_kg) : 0),
          maxKey: "payload_leo_kg" as const,
        },
        {
          label: "Payload GTO",
          getValue: (r: any) =>
            r.payload_gto_kg ? `${Number(r.payload_gto_kg).toLocaleString()} kg` : "—",
          barValue: (r: any) => (r.payload_gto_kg ? parseFloat(r.payload_gto_kg) : 0),
          maxKey: "payload_gto_kg" as const,
        },
        {
          label: "Engines (S1)",
          getValue: (r: any) => {
            const engines = r.engines || [];
            const s1Engines = engines.filter((e: any) => e.stage === 1);
            if (!s1Engines.length) return "—";
            return s1Engines
              .map((e: any) => `${e.engine_count > 1 ? `${e.engine_count}× ` : ""}${e.name}`)
              .join(", ");
          },
        },
        {
          label: "Propellant",
          getValue: (r: any) => {
            const engines = r.engines || [];
            const s1 = engines.find((e: any) => e.stage === 1);
            return s1?.propellant || "—";
          },
        },
      ],
    },
    {
      section: "Launches",
      fields: [
        { label: "Total Launches", getValue: (r: any) => r.total_launches ?? 0 },
        {
          label: "Success / Failure",
          getValue: (r: any) =>
            `${r.successful_launches ?? 0} / ${r.failed_launches ?? 0}`,
        },
        {
          label: "Success Rate",
          getValue: (r: any) => {
            const total = r.total_launches || 0;
            const success = r.successful_launches || 0;
            if (total === 0) return "—";
            return `${((success / total) * 100).toFixed(1)}%`;
          },
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* 3-Column Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((colIndex) => (
          <RocketSelector
            key={colIndex}
            allRockets={allRockets}
            selectedSlug={selectedSlugs[colIndex - 1] || null}
            onSelect={(slug) => handleSelect(colIndex - 1, slug)}
            onClear={() => handleClear(colIndex - 1)}
            columnNumber={colIndex}
          />
        ))}
      </div>

      {/* Grid Table */}
      <div className="border border-white/10 bg-[#04060b] overflow-x-auto">
        <div className="min-w-[768px]">
          {/* 3D Models Row */}
          <div className="grid grid-cols-4 border-b border-white/10 align-stretch">
            <div className="p-4 border-r border-white/10 bg-white/[0.005] flex flex-col justify-end">
              <span className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-mono block">
                Visual Size Comparison
              </span>
              <span className="text-[11px] text-white/25 mt-1 font-light leading-snug">
                Drag each viewport to rotate and inspect modules, structural details, and boosters.
              </span>
            </div>
            {[0, 1, 2].map((i) => {
              const r = activeRockets[i];
              const slug = selectedSlugs[i];
              const loading = loadingDetails[slug];

              return (
                <div key={i} className="border-r border-white/10 last:border-0 relative">
                  {loading ? (
                    <div className="w-full aspect-[2/3] grid place-items-center text-white/40 text-xs font-mono">
                      Loading specs…
                    </div>
                  ) : r ? (
                    <RocketViewer3D
                      spec={{
                        name: r.name,
                        family: r.family?.name,
                        height_m: r.height_m,
                        diameter_m: r.diameter_m,
                        stages: r.stages,
                        thrust_kn: r.thrust_kn,
                        reusable: r.reusable,
                      }}
                    />
                  ) : (
                    <div className="w-full aspect-[2/3] grid place-items-center text-white/15 text-xs tracking-widest uppercase bg-white/[0.002]">
                      Select vehicle
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Specs Rows */}
          {specFields.map((sect) => (
            <div key={sect.section}>
              {/* Section Header */}
              <div className="bg-white/[0.02] border-b border-white/10 px-4 py-2 text-[10px] tracking-[0.25em] uppercase text-[var(--color-space-accent-2)]/80 font-mono">
                {sect.section}
              </div>

              {/* Rows */}
              {sect.fields.map((field, rIdx) => (
                <div
                  key={rIdx}
                  className="grid grid-cols-4 border-b border-white/5 last:border-b-0 hover:bg-white/[0.01] transition-colors"
                >
                  {/* Label */}
                  <div className="p-4 border-r border-white/10 bg-white/[0.003] flex items-center">
                    <span className="text-xs text-white/50">{field.label}</span>
                  </div>

                  {/* Rocket Columns */}
                  {[0, 1, 2].map((i) => {
                    const r = activeRockets[i];
                    const barValue = field.barValue && r ? field.barValue(r) : 0;
                    const maxVal = field.maxKey ? numericMaxs[field.maxKey] : 0;

                    return (
                      <div
                        key={i}
                        className="p-4 border-r border-white/10 last:border-0 text-sm font-light text-white/80"
                      >
                        {r ? (
                          <>
                            <div>{field.getValue(r)}</div>
                            {barValue > 0 && maxVal > 0 && (
                              <div className="h-1 bg-white/5 mt-2 w-full rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${(barValue / maxVal) * 100}%`,
                                    backgroundColor: "var(--color-space-accent-2)",
                                  }}
                                />
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-white/10 font-mono">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ComparePage() {
  const [allRockets, setAllRockets] = useState<Rocket[]>([]);
  const [loading, setLoading] = useState(true);

  // Load rocket lists on page mount
  useEffect(() => {
    api
      .rockets()
      .then((data) => {
        setAllRockets(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Fleet Analysis"
        title="Compare Vehicles"
        meta="Select up to three launch vehicles to compare side-by-side specifications, capacity records, and orbital performance."
      />

      {loading ? (
        <div className="text-center py-12 text-white/40 text-sm font-mono tracking-widest uppercase">
          Loading fleet inventory…
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="text-center py-12 text-white/40 text-sm font-mono tracking-widest uppercase">
              Loading comparisons…
            </div>
          }
        >
          <CompareContent allRockets={allRockets} />
        </Suspense>
      )}
    </div>
  );
}
