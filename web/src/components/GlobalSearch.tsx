"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/clientApi";

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
const KIND_LABEL: Record<Result["kind"], string> = {
  rocket: "Rocket",
  satellite: "Satellite",
  agency: "Agency",
};

// Global command-palette search: a header trigger + an overlay openable from any
// page via the button, ⌘K / Ctrl-K, or "/". Instant grouped results, full
// keyboard navigation. The /search page remains the deep, shareable view.
export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setResults([]);
    setActive(0);
  }, []);

  // Open/close hotkeys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing && !open)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // Debounced query.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await apiFetch(`/api/v1/search?q=${encodeURIComponent(term)}`);
        const data: Result[] = r.ok ? await r.json() : [];
        setResults(data.slice(0, 12));
        setActive(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const go = useCallback(
    (r: Result) => {
      router.push(`${HREF[r.kind]}${r.slug}`);
      close();
    },
    [router, close],
  );

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (results[active]) go(results[active]);
      else if (q.trim()) {
        router.push(`/search?q=${encodeURIComponent(q.trim())}`);
        close();
      }
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-[11px] tracking-[0.18em] uppercase text-white/55 hover:text-white border border-white/15 hover:border-white/30 px-3 py-1.5 transition-colors"
        aria-label="Search"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        Search
        <span className="hidden sm:inline text-white/30 border border-white/15 px-1 rounded-sm text-[9px]">⌘K</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm" onClick={close}>
          <div
            className="mx-auto mt-[12vh] max-w-2xl bg-[#0a0e1a] border border-white/15 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-5 border-b border-white/10">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Search rockets, satellites, agencies…"
                className="flex-1 bg-transparent py-4 text-lg font-light outline-none placeholder:text-white/25"
              />
              <kbd className="text-[10px] text-white/30 border border-white/15 px-1.5 py-0.5 rounded-sm">esc</kbd>
            </div>

            <div className="max-h-[55vh] overflow-y-auto">
              {q.trim().length < 2 ? (
                <div className="px-5 py-8 text-center text-[11px] tracking-[0.2em] uppercase text-white/30">
                  Type to search the catalog
                </div>
              ) : loading && results.length === 0 ? (
                <div className="px-5 py-8 text-center text-[11px] tracking-[0.2em] uppercase text-white/30">
                  Searching…
                </div>
              ) : results.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-white/40">No matches for “{q.trim()}”.</div>
              ) : (
                <ul className="py-2">
                  {results.map((r, i) => (
                    <li key={`${r.kind}-${r.slug}`}>
                      <button
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(r)}
                        className={`w-full flex items-center justify-between gap-4 px-5 py-2.5 text-left ${
                          i === active ? "bg-white/[0.06]" : ""
                        }`}
                      >
                        <span className={`font-light ${i === active ? "text-[var(--color-space-accent-2)]" : ""}`}>
                          {r.name}
                        </span>
                        <span className="text-[10px] tracking-[0.18em] uppercase text-white/35">{KIND_LABEL[r.kind]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {results.length > 0 && (
              <button
                onClick={() => {
                  router.push(`/search?q=${encodeURIComponent(q.trim())}`);
                  close();
                }}
                className="w-full border-t border-white/10 px-5 py-2.5 text-left text-[11px] tracking-[0.2em] uppercase text-white/40 hover:text-white"
              >
                View all results →
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
