export const runtime = "edge";
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface Sat {
  id: string;
  slug: string;
  name: string;
  norad_id: number | null;
  purpose: string | null;
  constellation: string | null;
  orbit_type: string | null;
  status: string | null;
  owner_code: string | null;
  object_type: string | null;
  launch_year: number | null;
}

const PURPOSES = [
  "Communications", "Navigation", "Earth Observation", "Weather",
  "Space Telescope", "Human Spaceflight", "Planetary Science", "Technology",
];
const ORBITS = ["LEO", "MEO", "GEO", "HEO", "Lunar", "Mars", "Heliocentric", "Interstellar"];
const TYPES = [["", "All objects"], ["PAY", "Payloads"], ["R/B", "Rocket bodies"], ["DEB", "Debris"]];
const STATUSES = [["", "Any status"], ["active", "Active"], ["decayed", "Decayed"]];

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[#06080f] border border-white/15 text-white/80 text-[11px] tracking-[0.1em] uppercase px-3 py-2 outline-none focus:border-[var(--color-space-accent-2)] cursor-pointer"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v} className="bg-[#06080f]">{l}</option>
      ))}
    </select>
  );
}

export default function SatellitesPage() {
  const [purpose, setPurpose] = useState("");
  const [orbit, setOrbit] = useState("");
  const [status, setStatus] = useState("");
  const [objectType, setObjectType] = useState("PAY");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Sat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(async () => {
      const params = new URLSearchParams({ limit: "120" });
      if (purpose) params.set("purpose", purpose);
      if (orbit) params.set("orbit_type", orbit);
      if (status) params.set("status", status);
      if (objectType) params.set("object_type", objectType);
      if (q.trim()) params.set("q", q.trim());
      try {
        const r = await fetch(`/api/v1/satellites?${params}`);
        setItems(r.ok ? await r.json() : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [purpose, orbit, status, objectType, q]);

  const orbitOptions = useMemo<[string, string][]>(
    () => [["", "Any orbit"], ...ORBITS.map((o) => [o, o] as [string, string])],
    [],
  );

  return (
    <div>
      <p className="text-[11px] tracking-[0.35em] uppercase text-[var(--color-space-accent-2)]/75">
        The Live Sky · 26,000+ objects
      </p>
      <div className="flex items-end justify-between gap-4 mt-4 mb-8">
        <h1 className="font-light uppercase leading-[0.95] tracking-tight text-5xl sm:text-6xl">Satellites</h1>
        <Link
          href="/track"
          className="mb-1 inline-block border border-white/70 px-6 py-3 text-[11px] tracking-[0.25em] uppercase text-white hover:bg-white hover:text-black transition-colors whitespace-nowrap"
        >
          Live Tracker →
        </Link>
      </div>

      {/* Purpose facet pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setPurpose("")}
          className={`text-[11px] tracking-[0.12em] uppercase px-3 py-1.5 border transition-colors ${
            purpose === "" ? "bg-white text-black border-white" : "border-white/15 text-white/55 hover:text-white"
          }`}
        >
          All
        </button>
        {PURPOSES.map((p) => (
          <button
            key={p}
            onClick={() => setPurpose(purpose === p ? "" : p)}
            className={`text-[11px] tracking-[0.12em] uppercase px-3 py-1.5 border transition-colors ${
              purpose === p ? "bg-white text-black border-white" : "border-white/15 text-white/55 hover:text-white"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Secondary filters + search */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Select value={orbit} onChange={setOrbit} options={orbitOptions} />
        <Select value={status} onChange={setStatus} options={STATUSES as [string, string][]} />
        <Select value={objectType} onChange={setObjectType} options={TYPES as [string, string][]} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name…"
          className="flex-1 min-w-[180px] bg-[#06080f] border border-white/15 px-3 py-2 text-sm outline-none focus:border-[var(--color-space-accent-2)] placeholder:text-white/25"
        />
      </div>

      <div className="text-[11px] tracking-[0.2em] uppercase text-white/35 font-mono mb-4 h-4">
        {loading ? "loading…" : `${items.length}${items.length === 120 ? "+" : ""} results`}
      </div>

      {!loading && items.length === 0 ? (
        <div className="border border-white/10 bg-white/[0.015] p-12 text-center text-sm text-white/40">
          No satellites match these filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5">
          {items.map((s) => (
            <Link
              key={s.id}
              href={`/satellites/${s.slug}`}
              className="group bg-[#06080f] p-4 hover:bg-[#0c1322] transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-light truncate group-hover:text-[var(--color-space-accent-2)] transition-colors">
                  {s.name}
                </span>
                <span
                  className={`mt-1.5 inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    s.status === "active" ? "bg-emerald-400" : "bg-white/25"
                  }`}
                  title={s.status ?? ""}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono uppercase tracking-wide text-white/40">
                {s.purpose && <span className="text-[var(--color-space-accent-2)]/80">{s.purpose}</span>}
                {s.orbit_type && <span>{s.orbit_type}</span>}
                {s.constellation && <span>{s.constellation}</span>}
                {s.launch_year && <span>{s.launch_year}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
