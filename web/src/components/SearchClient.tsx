"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Eyebrow } from "@/components/ui";
import { apiJSON, isAbort } from "@/lib/clientApi";

export interface SearchResult {
  kind: "rocket" | "satellite" | "agency";
  slug: string;
  name: string;
}

const HREF: Record<SearchResult["kind"], string> = {
  rocket: "/rockets/",
  satellite: "/satellites/",
  agency: "/agencies/",
};
const LABEL: Record<SearchResult["kind"], string> = {
  rocket: "Rockets",
  satellite: "Satellites",
  agency: "Agencies",
};
const GROUPS: SearchResult["kind"][] = ["rocket", "satellite", "agency"];

export default function SearchClient({ initialQuery, initialResults }: { initialQuery: string; initialResults: SearchResult[] }) {
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>(initialResults);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [touched, setTouched] = useState(initialQuery.length >= 2);
  const first = useRef(true);

  // Debounced, cancellable query against the trigram-indexed /search endpoint.
  // The URL follows along so the page stays shareable — via replaceState, which
  // Next keeps in sync without re-rendering the server page (router.replace
  // would re-run the search on the server for nothing).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      if (initialQuery === q) return; // server already rendered these results
    }
    const term = q.trim();
    const t0 = setTimeout(() => {
      window.history.replaceState(null, "", term ? `/search?q=${encodeURIComponent(term)}` : "/search");
    }, 400);
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      setFailed(false);
      return () => clearTimeout(t0);
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const data = await apiJSON<SearchResult[]>(`/api/v1/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        setResults(Array.isArray(data) ? data : []);
        setFailed(false);
      } catch (e) {
        if (isAbort(e)) return;
        setResults([]);
        setFailed(true);
      }
      setLoading(false);
      setTouched(true);
    }, 200);
    return () => {
      clearTimeout(t);
      clearTimeout(t0);
      ctrl.abort();
    };
  }, [q, initialQuery]);

  const term = q.trim();

  return (
    <div>
      <Eyebrow>Search</Eyebrow>
      <h1 className="mb-8 mt-4 text-title font-light uppercase tracking-tight">Find anything</h1>

      <label htmlFor="search-input" className="sr-only">
        Search rockets, satellites and agencies
      </label>
      <input
        id="search-input"
        type="search"
        autoFocus={!initialQuery}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Falcon 9, ISS, Starlink, NASA…"
        autoComplete="off"
        spellCheck={false}
        className="w-full border-b border-line-strong bg-transparent py-4 text-2xl font-light tracking-wide outline-none transition-colors placeholder:text-ink-4 focus:border-accent"
      />

      <div className="mt-3 h-4 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-4" aria-live="polite">
        {loading ? "searching…" : failed ? "search unavailable — try again" : term.length >= 2 ? `${results.length} results` : "type at least 2 characters"}
      </div>

      <div className="mt-8 space-y-10">
        {GROUPS.map((g) => {
          const items = results.filter((r) => r.kind === g);
          if (!items.length) return null;
          return (
            <section key={g}>
              <h2 className="mb-3 border-b border-line pb-2 font-mono text-[11px] uppercase tracking-[0.28em] text-ink-3">
                {LABEL[g]} · {items.length}
              </h2>
              <ul className="divide-y divide-line">
                {items.map((r) => (
                  <li key={`${r.kind}-${r.slug}`}>
                    <Link href={`${HREF[r.kind]}${r.slug}`} className="group flex items-center justify-between py-3">
                      <span className="font-light transition-colors group-hover:text-accent">{r.name}</span>
                      <span aria-hidden className="text-ink-4 transition-colors group-hover:text-ink-2">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {touched && !loading && !failed && term.length >= 2 && results.length === 0 && (
          <p className="text-sm text-ink-3">No matches for “{term}”.</p>
        )}
      </div>
    </div>
  );
}
