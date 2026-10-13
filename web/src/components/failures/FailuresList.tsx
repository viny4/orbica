"use client";

import { useState, useMemo, useDeferredValue } from "react";
import Link from "next/link";
import { type LaunchRow, getLaunchTitle } from "@/lib/api";
import { Outcome, outcomeKey } from "@/components/ui";

type Filter = "all" | "failure" | "partial_failure";

// Filterable anomaly archive. Typing stays responsive on 1,000 rows because the
// filter runs on a deferred copy of the query, and off-screen rows skip layout
// (content-visibility) while staying in the DOM.
export function FailuresList({ failures }: { failures: LaunchRow[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const q = useDeferredValue(search.trim().toLowerCase());

  const counts = useMemo(() => {
    let total = 0;
    let partial = 0;
    for (const f of failures) {
      const k = outcomeKey(f.outcome);
      if (k === "partial_failure") partial++;
      else total++;
    }
    return { all: failures.length, failure: total, partial_failure: partial };
  }, [failures]);

  const filtered = useMemo(
    () =>
      failures.filter((f) => {
        const k = outcomeKey(f.outcome);
        if (filter !== "all" && (filter === "partial_failure" ? k !== "partial_failure" : k === "partial_failure")) return false;
        if (!q) return true;
        return (
          f.name?.toLowerCase().includes(q) ||
          f.mission_name?.toLowerCase().includes(q) ||
          f.rocket_name?.toLowerCase().includes(q) ||
          f.agency_name?.toLowerCase().includes(q)
        );
      }),
    [failures, q, filter],
  );

  const tabs: [Filter, string][] = [
    ["all", "All anomalies"],
    ["failure", "Total failures"],
    ["partial_failure", "Partial failures"],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <label className="flex-1">
          <span className="sr-only">Search failures</span>
          <input
            type="search"
            placeholder="Search by mission, rocket or agency…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="field w-full py-3"
          />
        </label>
        <div className="flex flex-wrap gap-1 border border-line p-1" role="group" aria-label="Outcome">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              aria-pressed={filter === k}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                filter === k ? "bg-danger/15 text-danger" : "text-ink-3 hover:text-ink"
              }`}
            >
              {label} <span className="text-ink-4">{counts[k]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-4" aria-live="polite">
        {filtered.length.toLocaleString("en-US")} of {failures.length.toLocaleString("en-US")} records
      </div>

      <div className="border border-line bg-surface">
        <div className="hidden grid-cols-[88px_minmax(0,2fr)_minmax(0,1.4fr)_140px] border-b border-line bg-white/[0.02] px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-danger/70 sm:grid">
          <div>Year</div>
          <div>Mission</div>
          <div>Vehicle &amp; agency</div>
          <div className="text-right">Outcome</div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center font-mono text-xs uppercase tracking-widest text-ink-3">No anomalies match.</div>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((f) => (
              <li key={f.id} className="[content-visibility:auto] [contain-intrinsic-size:auto_72px]">
                <Link
                  href={`/launches/${f.id}`}
                  className="group grid grid-cols-[56px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-4 py-4 transition-colors hover:bg-white/[0.02] sm:grid-cols-[88px_minmax(0,2fr)_minmax(0,1.4fr)_140px]"
                >
                  <div className="row-span-2 font-mono text-xs text-ink-3 sm:row-span-1">{f.launch_year || "—"}</div>
                  <div className="truncate text-sm font-light text-ink transition-colors group-hover:text-danger">
                    {getLaunchTitle(f.mission_name, f.name, f.rocket_name)}
                  </div>
                  <div className="min-w-0 truncate text-xs text-ink-3 sm:text-ink-2">
                    {f.rocket_name || "Unknown rocket"}
                    <span className="text-ink-4 sm:hidden"> · {f.agency_name}</span>
                    <div className="hidden truncate font-mono text-[10px] uppercase text-ink-4 sm:block">{f.agency_name}</div>
                  </div>
                  <div className="col-start-2 sm:col-start-auto sm:text-right">
                    <Outcome outcome={f.outcome} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
