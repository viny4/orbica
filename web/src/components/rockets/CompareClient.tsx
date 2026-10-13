"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Chip } from "@/components/ui";
import { WebGLGuard, WebGLFallback } from "@/components/three/WebGLGuard";

const RocketViewer3D = dynamic(() => import("@/components/rockets/RocketViewer3D"), {
  ssr: false,
  loading: () => (
    <div className="grid aspect-[2/3] w-full place-items-center font-mono text-[11px] uppercase tracking-widest text-ink-4">Loading 3D model…</div>
  ),
});

export interface RocketOption {
  slug: string;
  name: string;
  variant: string | null;
  status: string | null;
}

type R = Record<string, any>;

function RocketSelector({
  options,
  selected,
  onSelect,
  onClear,
  column,
}: {
  options: RocketOption[];
  selected: R | null;
  onSelect: (slug: string) => void;
  onClear: () => void;
  column: number;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return (q ? options.filter((r) => r.name.toLowerCase().includes(q)) : options).slice(0, 12);
  }, [options, search]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (selected) {
    return (
      <div className="card relative flex h-[120px] flex-col justify-between p-4">
        <div className="min-w-0 pr-8">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-ink-4">Vehicle {column}</span>
          <span className="block truncate text-base font-light">{selected.name}</span>
          {selected.variant && <span className="mt-0.5 block truncate font-mono text-[11px] text-ink-3">{selected.variant}</span>}
        </div>
        <button onClick={onClear} className="absolute right-3 top-3 p-1 text-ink-3 transition-colors hover:text-ink" aria-label={`Remove ${selected.name}`}>
          ✕
        </button>
        <Link href={`/rockets/${selected.slug}`} className="font-mono text-[10px] uppercase tracking-widest text-accent/80 transition-colors hover:text-accent">
          View specs →
        </Link>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative flex h-[120px] flex-col justify-center border border-dashed border-line-strong p-4 transition-colors hover:bg-white/[0.015]">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full text-left font-mono text-xs uppercase tracking-[0.15em] text-ink-3 transition-colors hover:text-ink"
      >
        + Add rocket {column}
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto border border-line-strong bg-surface shadow-xl">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the fleet…"
            aria-label="Search rockets"
            className="field w-full border-0 border-b text-xs"
            autoFocus
          />
          <ul>
            {filtered.map((r) => (
              <li key={r.slug}>
                <button
                  onClick={() => {
                    onSelect(r.slug);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="flex w-full justify-between px-3 py-2 text-left text-xs text-ink-2 transition-colors hover:bg-white/[0.05] hover:text-accent"
                >
                  <span className="truncate">{r.name}</span>
                  <span className="ml-2 shrink-0 font-mono text-[10px] text-ink-4">{r.variant || r.status || ""}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-3 py-2 text-[11px] italic text-ink-4">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

const num = (v: unknown) => (v ? parseFloat(String(v)) : 0);

type Field = { label: string; getValue: (r: R) => React.ReactNode; barValue?: (r: R) => number };

const SECTIONS: { section: string; fields: Field[] }[] = [
  {
    section: "Overview",
    fields: [
      { label: "Manufacturer", getValue: (r) => r.manufacturer?.name || "Unknown" },
      { label: "Country", getValue: (r) => r.manufacturer?.country_code || "—" },
      { label: "Status", getValue: (r) => <Chip tone={r.status === "active" ? "success" : "muted"}>{r.status || "Unknown"}</Chip> },
      { label: "Reusability", getValue: (r) => (r.reusable ? "Reusable" : "Expendable") },
      { label: "First flight", getValue: (r) => r.first_flight || "—" },
      { label: "Last flight", getValue: (r) => r.last_flight || "—" },
    ],
  },
  {
    section: "Dimensions",
    fields: [
      { label: "Height", getValue: (r) => (r.height_m ? `${r.height_m} m` : "—"), barValue: (r) => num(r.height_m) },
      { label: "Diameter", getValue: (r) => (r.diameter_m ? `${r.diameter_m} m` : "—"), barValue: (r) => num(r.diameter_m) },
      { label: "Mass", getValue: (r) => (r.mass_kg ? `${Number(r.mass_kg).toLocaleString()} kg` : "—"), barValue: (r) => num(r.mass_kg) },
      { label: "Stages", getValue: (r) => r.stages || "—" },
    ],
  },
  {
    section: "Performance & propulsion",
    fields: [
      { label: "Payload LEO", getValue: (r) => (r.payload_leo_kg ? `${Number(r.payload_leo_kg).toLocaleString()} kg` : "—"), barValue: (r) => num(r.payload_leo_kg) },
      { label: "Payload GTO", getValue: (r) => (r.payload_gto_kg ? `${Number(r.payload_gto_kg).toLocaleString()} kg` : "—"), barValue: (r) => num(r.payload_gto_kg) },
      {
        label: "Engines (S1)",
        getValue: (r) => {
          const s1 = ((r.engines || []) as R[]).filter((e) => e.stage === 1);
          return s1.length ? s1.map((e) => `${e.engine_count > 1 ? `${e.engine_count}× ` : ""}${e.name}`).join(", ") : "—";
        },
      },
      { label: "Propellant", getValue: (r) => ((r.engines || []) as R[]).find((e) => e.stage === 1)?.propellant || "—" },
    ],
  },
  {
    section: "Launches",
    fields: [
      { label: "Total launches", getValue: (r) => r.total_launches ?? 0, barValue: (r) => num(r.total_launches) },
      { label: "Success / failure", getValue: (r) => `${r.successful_launches ?? 0} / ${r.failed_launches ?? 0}` },
      {
        label: "Success rate",
        getValue: (r) => (r.total_launches ? `${(((r.successful_launches || 0) / r.total_launches) * 100).toFixed(1)}%` : "—"),
      },
    ],
  },
];

export default function CompareClient({ options, slugs, details }: { options: RocketOption[]; slugs: string[]; details: (R | null)[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const go = (next: string[]) => {
    const p = new URLSearchParams();
    next.filter(Boolean).forEach((s) => p.append("r", s));
    startTransition(() => router.push(p.size ? `/compare?${p}` : "/compare", { scroll: false }));
  };

  const cols = [0, 1, 2].map((i) => details[i] ?? null);
  const unknown = slugs.filter((_, i) => !details[i]);

  return (
    <div className={`space-y-6 transition-opacity ${pending ? "opacity-60" : ""}`}>
      {unknown.length > 0 && <p className="text-sm text-warning">Couldn&apos;t find: {unknown.join(", ")}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <RocketSelector
            key={i}
            options={options}
            selected={cols[i]}
            column={i + 1}
            onSelect={(slug) => {
              const next = cols.map((c) => c?.slug ?? "").filter(Boolean);
              next[Math.min(i, next.length)] = slug;
              go(next);
            }}
            onClear={() => go(cols.filter((_, j) => j !== i).map((c) => c?.slug ?? ""))}
          />
        ))}
      </div>

      <div className="overflow-x-auto border border-line bg-surface">
        <div className="min-w-[768px]">
          <div className="grid grid-cols-4 border-b border-line">
            <div className="flex flex-col justify-end border-r border-line p-4">
              <span className="block font-mono text-[10px] uppercase tracking-[0.25em] text-ink-3">Visual size comparison</span>
              <span className="mt-1 text-[11px] font-light leading-snug text-ink-4">Drag a model to rotate it.</span>
            </div>
            {cols.map((r, i) => (
              <div key={i} className="relative border-r border-line last:border-0">
                {r ? (
                  <WebGLGuard fallback={<WebGLFallback className="aspect-[2/3]" label="3D needs WebGL" />}>
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
                  </WebGLGuard>
                ) : (
                  <div className="grid aspect-[2/3] w-full place-items-center font-mono text-xs uppercase tracking-widest text-ink-4">Select vehicle</div>
                )}
              </div>
            ))}
          </div>

          {SECTIONS.map((sect) => (
            <div key={sect.section}>
              <div className="border-b border-line bg-white/[0.02] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-accent/80">{sect.section}</div>
              {sect.fields.map((field) => {
                const max = field.barValue ? Math.max(0, ...cols.map((r) => (r ? field.barValue!(r) : 0))) : 0;
                return (
                  <div key={field.label} className="grid grid-cols-4 border-b border-line transition-colors last:border-b-0 hover:bg-white/[0.015]">
                    <div className="flex items-center border-r border-line p-4">
                      <span className="text-xs text-ink-3">{field.label}</span>
                    </div>
                    {cols.map((r, i) => {
                      const v = r && field.barValue ? field.barValue(r) : 0;
                      return (
                        <div key={i} className="border-r border-line p-4 text-sm font-light text-ink-2 last:border-0">
                          {r ? (
                            <>
                              <div>{field.getValue(r)}</div>
                              {v > 0 && max > 0 && (
                                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/5">
                                  <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(v / max) * 100}%` }} />
                                </div>
                              )}
                            </>
                          ) : (
                            <span aria-hidden className="font-mono text-ink-4">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
