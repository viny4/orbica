export const runtime = "edge";
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eyebrow } from "@/components/ui";

interface Result {
  kind: "rocket" | "satellite" | "agency";
  slug: string;
  name: string;
}

const HREF: Record<Result["kind"], string> = {
  rocket: "/rockets/",
  satellite: "/satellites/",
  agency: "/agencies/",
};
const LABEL: Record<Result["kind"], string> = {
  rocket: "Rockets",
  satellite: "Satellites",
  agency: "Agencies",
};

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  // Debounced query against the trigram-indexed /search endpoint.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/v1/search?q=${encodeURIComponent(term)}`);
        setResults(r.ok ? await r.json() : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setTouched(true);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const groups: Result["kind"][] = ["rocket", "satellite", "agency"];

  return (
    <div>
      <Eyebrow>Search</Eyebrow>
      <h1 className="mt-4 mb-8 font-light uppercase leading-[0.95] tracking-tight text-5xl sm:text-6xl">
        Find anything
      </h1>

      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Falcon 9, ISS, Starlink, NASA…"
        className="w-full bg-transparent border-b border-white/20 focus:border-[var(--color-space-accent-2)] outline-none py-4 text-2xl font-light tracking-wide placeholder:text-white/25 transition-colors"
      />

      <div className="mt-3 text-[11px] tracking-[0.2em] uppercase text-white/35 font-mono h-4">
        {loading ? "searching…" : q.trim().length >= 2 ? `${results.length} results` : "type to search"}
      </div>

      <div className="mt-8 space-y-10">
        {groups.map((g) => {
          const items = results.filter((r) => r.kind === g);
          if (!items.length) return null;
          return (
            <section key={g}>
              <h2 className="text-[11px] tracking-[0.3em] uppercase text-white/45 mb-3 border-b border-white/10 pb-2">
                {LABEL[g]} · {items.length}
              </h2>
              <ul className="divide-y divide-white/10">
                {items.map((r) => (
                  <li key={`${r.kind}-${r.slug}`}>
                    <Link
                      href={`${HREF[r.kind]}${r.slug}`}
                      className="flex items-center justify-between py-3 group"
                    >
                      <span className="font-light group-hover:text-[var(--color-space-accent-2)] transition-colors">
                        {r.name}
                      </span>
                      <span className="text-white/20 group-hover:text-white/50 transition-colors">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {touched && !loading && q.trim().length >= 2 && results.length === 0 && (
          <p className="text-white/40 text-sm">No matches for “{q.trim()}”.</p>
        )}
      </div>
    </div>
  );
}
