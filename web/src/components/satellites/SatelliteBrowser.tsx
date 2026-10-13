"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiJSON, isAbort } from "@/lib/clientApi";
import { SafeImg } from "@/components/SafeImg";
import { SatelliteGlyph, glyphSeed } from "@/components/satellites/SatelliteGlyph";
import { PAGE_SIZE, filterQuery, pageUrl, type Sat, type SatFilters } from "./satFilters";

const PURPOSES = [
  "Communications", "Navigation", "Earth Observation", "Weather",
  "Space Telescope", "Human Spaceflight", "Planetary Science", "Technology",
];
const ORBITS: [string, string][] = [["", "Any orbit"], ...["LEO", "MEO", "GEO", "HEO", "Lunar", "Mars", "Heliocentric", "Interstellar"].map((o) => [o, o] as [string, string])];
const TYPES: [string, string][] = [["", "All objects"], ["PAY", "Payloads"], ["R/B", "Rocket bodies"], ["DEB", "Debris"]];
const STATUSES: [string, string][] = [["", "Any status"], ["active", "Active"], ["decayed", "Decayed"]];

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field cursor-pointer py-2 pr-8 font-mono text-[11px] uppercase tracking-[0.1em]">
        {options.map(([v, l]) => (
          <option key={v} value={v} className="bg-surface">
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Glyph({ s }: { s: Sat }) {
  return <SatelliteGlyph name={s.name} purpose={s.purpose} orbitType={s.orbit_type} objectType={s.object_type} seed={glyphSeed(s.norad_id, s.slug)} />;
}

// Interactive catalogue browser. The first page arrives server-rendered for the
// filters in the URL; every change after that queries the API directly (each
// request cancels the one before, so a slow response can't overwrite newer
// filters) and mirrors the filters into the URL so views are shareable.
export default function SatelliteBrowser({ initialFilters, initialItems }: { initialFilters: SatFilters; initialItems: Sat[] | null }) {
  const [f, setF] = useState<SatFilters>(initialFilters);
  const [items, setItems] = useState<Sat[]>(initialItems ?? []);
  const [loading, setLoading] = useState(initialItems === null);
  const [failed, setFailed] = useState(false);
  const [more, setMore] = useState((initialItems?.length ?? 0) === PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const skipFirst = useRef(initialItems !== null);

  const set = (patch: Partial<SatFilters>) => setF((prev) => ({ ...prev, ...patch }));
  const key = useMemo(() => filterQuery(f), [f]);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    window.history.replaceState(null, "", pageUrl(f));
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const data = await apiJSON<Sat[]>(`/api/v1/satellites?${key}`, { signal: ctrl.signal });
        setItems(data);
        setMore(data.length === PAGE_SIZE);
        setFailed(false);
      } catch (e) {
        if (isAbort(e)) return;
        setItems([]);
        setFailed(true);
      }
      setLoading(false);
    }, f.q ? 250 : 0);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const data = await apiJSON<Sat[]>(`/api/v1/satellites?${filterQuery(f, items.length)}`);
      setItems((prev) => [...prev, ...data]);
      setMore(data.length === PAGE_SIZE);
    } catch {
      setMore(true);
    } finally {
      setLoadingMore(false);
    }
  };

  const pill = (active: boolean) =>
    `px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] border transition-colors ${
      active ? "bg-white text-black border-white" : "border-line-strong text-ink-3 hover:text-ink hover:border-ink-4"
    }`;

  return (
    <div>
      {/* Purpose facet pills */}
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Purpose">
        <button onClick={() => set({ purpose: "" })} aria-pressed={f.purpose === ""} className={pill(f.purpose === "")}>
          All
        </button>
        {PURPOSES.map((p) => (
          <button key={p} onClick={() => set({ purpose: f.purpose === p ? "" : p })} aria-pressed={f.purpose === p} className={pill(f.purpose === p)}>
            {p}
          </button>
        ))}
      </div>

      {/* Secondary filters + search */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Select label="Orbit" value={f.orbit} onChange={(v) => set({ orbit: v })} options={ORBITS} />
        <Select label="Status" value={f.status} onChange={(v) => set({ status: v })} options={STATUSES} />
        <Select label="Object type" value={f.type} onChange={(v) => set({ type: v })} options={TYPES} />
        <label className="min-w-[180px] flex-1">
          <span className="sr-only">Search by name</span>
          <input type="search" value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search by name…" className="field w-full" />
        </label>
      </div>

      <div className="mb-4 h-4 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-4" aria-live="polite">
        {loading ? "loading…" : failed ? "couldn't load satellites" : `${items.length.toLocaleString("en-US")}${more ? "+" : ""} results`}
      </div>

      {!loading && failed ? (
        <div className="border border-line p-12 text-center text-sm text-ink-3">The catalogue didn&apos;t answer — try changing a filter or reloading.</div>
      ) : !loading && items.length === 0 ? (
        <div className="border border-line p-12 text-center text-sm text-ink-3">No satellites match these filters.</div>
      ) : (
        <div className={`tile-grid sm:grid-cols-2 lg:grid-cols-3 transition-opacity duration-200 ${loading ? "opacity-50" : ""}`}>
          {items.map((s) => (
            <Link key={s.id} href={`/satellites/${s.slug}`} className="tile group defer-render">
              {/* Barely 3% of the catalogue has a photograph — the rest get a
                  generated diagram, which also catches a dead CDN URL. */}
              <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-b from-[#0a1020] to-[#05070f]">
                {s.image_url ? (
                  <SafeImg
                    src={s.image_url}
                    alt={s.name}
                    className="absolute inset-0 h-full w-full object-cover opacity-90 transition-[opacity,transform] duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
                    fallback={<Glyph s={s} />}
                    placeholder={<Glyph s={s} />}
                  />
                ) : (
                  <Glyph s={s} />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate font-light transition-colors group-hover:text-accent">{s.name}</span>
                  <span
                    className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${s.status === "active" ? "bg-success" : "bg-white/25"}`}
                    title={s.status ?? ""}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-wide text-ink-4">
                  {s.purpose && <span className="text-accent/80">{s.purpose}</span>}
                  {s.orbit_type && <span>{s.orbit_type}</span>}
                  {s.constellation && <span>{s.constellation}</span>}
                  {s.launch_year && <span>{s.launch_year}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {more && !loading && !failed && (
        <div className="mt-8 flex justify-center">
          <button onClick={loadMore} disabled={loadingMore} className="btn btn-secondary disabled:opacity-50">
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
