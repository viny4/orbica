"use client";

import { useEffect, useRef, useState, useCallback, useId } from "react";
import { useRouter } from "next/navigation";
import { apiJSON, isAbort } from "@/lib/clientApi";
import { useFocusTrap } from "@/hooks/useFocusTrap";

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

const SUGGESTIONS = ["ISS", "Falcon 9", "Starlink", "Hubble", "NASA", "Saturn V"];

// Global command-palette search: a header trigger + a modal openable from any
// page via the button, ⌘K / Ctrl-K, or "/". Each keystroke supersedes the last
// request (so a slow response can never overwrite newer results), repeated
// queries come from cache, and the /search page remains the shareable view.
export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  useFocusTrap(dialogRef, open);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setResults([]);
    setActive(0);
    setFailed(false);
  }, []);

  // Open/close hotkeys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing && !open)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Debounced, cancellable query.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      setFailed(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const data = await apiJSON<Result[]>(`/api/v1/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        setResults(Array.isArray(data) ? data.slice(0, 12) : []);
        setActive(0);
        setFailed(false);
        setLoading(false);
      } catch (e) {
        if (isAbort(e)) return; // superseded by a newer keystroke
        setResults([]);
        setFailed(true);
        setLoading(false);
      }
    }, 160);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const go = useCallback(
    (r: Result) => {
      router.push(`${HREF[r.kind]}${r.slug}`);
      close();
    },
    [router, close],
  );

  const searchAll = useCallback(() => {
    const term = q.trim();
    if (!term) return;
    router.push(`/search?q=${encodeURIComponent(term)}`);
    close();
  }, [q, router, close]);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (results[active]) go(results[active]);
      else searchAll();
    }
  };

  const term = q.trim();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-2 border border-line-strong px-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-2 transition-colors hover:border-ink-3 hover:text-ink sm:px-3"
        aria-label="Search the catalogue"
        aria-haspopup="dialog"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded-sm border border-line-strong px-1 text-[9px] text-ink-4 lg:inline">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm" onMouseDown={close}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Search the catalogue"
            className="mx-3 mt-[10vh] max-w-2xl border border-line-strong bg-surface shadow-2xl shadow-black/70 sm:mx-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-line px-4 sm:px-5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-ink-4" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Search rockets, satellites, agencies…"
                role="combobox"
                aria-expanded={results.length > 0}
                aria-controls={listId}
                aria-activedescendant={results[active] ? optionId(active) : undefined}
                aria-autocomplete="list"
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent py-4 text-lg font-light outline-none placeholder:text-ink-4"
              />
              {loading && <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border border-ink-4 border-t-accent" aria-hidden />}
              <button onClick={close} className="shrink-0 rounded-sm border border-line-strong px-1.5 py-0.5 text-[10px] text-ink-4 hover:text-ink" aria-label="Close search">
                esc
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
              {term.length < 2 ? (
                <div className="px-5 py-6">
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-4">Try</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => setQ(s)} className="border border-line px-3 py-1.5 text-sm text-ink-2 transition-colors hover:border-accent/50 hover:text-ink">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : failed ? (
                <div className="px-5 py-8 text-center text-sm text-ink-3">Search is unavailable right now — try again in a moment.</div>
              ) : loading && results.length === 0 ? (
                <div className="px-5 py-8 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-ink-4">Searching…</div>
              ) : results.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-ink-3">No matches for “{term}”.</div>
              ) : (
                <ul id={listId} role="listbox" aria-label="Results" className="py-2">
                  {results.map((r, i) => (
                    <li key={`${r.kind}-${r.slug}`} id={optionId(i)} role="option" aria-selected={i === active}>
                      <button
                        tabIndex={-1}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(r)}
                        className={`flex w-full items-center justify-between gap-4 px-5 py-2.5 text-left ${i === active ? "bg-white/[0.06]" : ""}`}
                      >
                        <span className={`truncate font-light ${i === active ? "text-accent" : ""}`}>{r.name}</span>
                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-4">{KIND_LABEL[r.kind]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {results.length > 0 && (
              <button
                onClick={searchAll}
                className="w-full border-t border-line px-5 py-3 text-left font-mono text-[11px] uppercase tracking-[0.2em] text-ink-3 hover:text-ink"
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
