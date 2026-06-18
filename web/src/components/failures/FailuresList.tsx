"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { type LaunchRow } from "@/lib/api";

export function FailuresList({ failures }: { failures: LaunchRow[] }) {
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("all");

  const filtered = useMemo(() => {
    return failures.filter((f) => {
      // Search match
      const q = search.toLowerCase();
      const matchesSearch = 
        !q || 
        f.name?.toLowerCase().includes(q) || 
        f.rocket_name?.toLowerCase().includes(q) ||
        f.agency_name?.toLowerCase().includes(q);

      // Outcome match
      const matchesOutcome = 
        outcomeFilter === "all" || 
        f.outcome?.toLowerCase().includes(outcomeFilter);

      return matchesSearch && matchesOutcome;
    });
  }, [failures, search, outcomeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search failures by mission, rocket, or agency..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-black/40 border border-white/10 px-4 py-3 text-sm text-white focus:border-[var(--color-space-accent-2)] outline-none font-light"
        />
        <select
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value)}
          className="bg-black/40 border border-white/10 px-4 py-3 text-sm text-white focus:border-[var(--color-space-accent-2)] outline-none font-light"
        >
          <option value="all">All Anomalies</option>
          <option value="failure">Total Failures</option>
          <option value="partial">Partial Failures</option>
        </select>
      </div>

      <div className="border border-white/10 bg-[#06080f]">
        <div className="grid grid-cols-[100px_minmax(200px,1fr)_1fr_1fr] bg-white/[0.02] border-b border-white/10 px-4 py-3 text-[10px] uppercase tracking-widest text-[var(--color-space-accent-2)]/80 font-mono">
          <div>Year</div>
          <div>Mission</div>
          <div className="hidden sm:block">Vehicle & Agency</div>
          <div>Outcome</div>
        </div>
        
        <div className="divide-y divide-white/5 max-h-[800px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-white/40 tracking-widest uppercase font-mono text-xs">
              No anomalies found matching criteria.
            </div>
          ) : (
            filtered.map((f: any) => (
              <Link 
                key={f.id} 
                href={`/launches/${f.id}`}
                className="grid grid-cols-[100px_minmax(200px,1fr)_1fr_1fr] px-4 py-4 hover:bg-white/[0.02] transition-colors group items-center"
              >
                <div className="text-xs font-mono text-white/50">{f.launch_year || "—"}</div>
                <div>
                  <div className="text-sm font-light text-white group-hover:text-[var(--color-space-accent-2)] transition-colors truncate pr-4">
                    {f.name}
                  </div>
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs text-white/70 truncate">{f.rocket_name || "Unknown Rocket"}</div>
                  <div className="text-[10px] text-white/40 font-mono uppercase mt-0.5 truncate">{f.agency_name}</div>
                </div>
                <div>
                  <span className={`inline-block px-2 py-1 text-[9px] uppercase tracking-wider font-mono border ${
                    f.outcome?.toLowerCase().includes("partial") 
                      ? "border-orange-500/30 text-orange-400 bg-orange-500/10" 
                      : "border-red-500/30 text-red-400 bg-red-500/10"
                  }`}>
                    {f.outcome || "Anomaly"}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
