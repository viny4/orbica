export const runtime = "edge";
"use client";

import { useEffect, useState } from "react";
import { PageHeader, Chip } from "@/components/ui";

interface SyncLog {
  id: string;
  timestamp: string;
  job_name: string;
  status: string;
  records_added: number;
  records_updated: number;
  details: Record<string, any> | null;
}

export default function SyncLogsPage() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "success" | "failure">("all");

  const limit = 20;

  const fetchLogs = (currentPage = page, currentQuery = filterQuery, currentStatus = filterStatus) => {
    setLoading(true);
    const offset = (currentPage - 1) * limit;
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      query: currentQuery,
      status: currentStatus
    });

    fetch(`/api/v1/sync-logs?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : { total: 0, data: [] }))
      .then((res: { total: number, data: SyncLog[] }) => {
        setLogs(res.data || []);
        setTotal(res.total || 0);
      })
      .catch(() => {
        setLogs([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs(page, filterQuery, filterStatus);
  }, [page, filterStatus]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs(1, filterQuery, filterStatus);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Calculate Overview Stats for the current view
  const lastSync = logs[0];
  const totalSuccess = logs.filter((l) => l.status === "success").length;
  const totalFailure = logs.filter((l) => l.status === "failure").length;
  const totalAdded = logs.reduce((sum, l) => sum + (l.records_added || 0), 0);
  const totalUpdated = logs.reduce((sum, l) => sum + (l.records_updated || 0), 0);
  const totalPages = Math.ceil(total / limit) || 1;

  // Group formatting for badges
  const getJobBadgeColor = (name: string) => {
    if (name.startsWith("tle-")) return "border-blue-500/30 text-blue-400";
    if (name === "launches") return "border-purple-500/30 text-purple-400";
    if (name === "news") return "border-emerald-500/30 text-emerald-400";
    if (name === "refresh-run") return "border-cyan-500/30 text-cyan-400";
    return "border-white/10 text-white/50";
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Database & Operations Telemetry"
        title="Sync Audit Logs"
        meta={
          <span className="flex items-center gap-2">
            <Chip tone="accent">System Status: Nominal</Chip>
            <Chip>{logs.length} jobs recorded</Chip>
          </span>
        }
      />

      {/* ── Overview Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border border-white/10 bg-white/[0.015] p-5 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Last Run Status</span>
          {lastSync ? (
            <div className="flex items-center gap-2.5 mt-2">
              <span className={`w-3 h-3 rounded-full ${lastSync.status === "success" ? "bg-emerald-400 animate-pulse" : "bg-red-500 animate-ping"}`} />
              <span className="text-lg font-light uppercase tracking-wider text-white">
                {lastSync.status === "success" ? "Succeeded" : "Failed"}
              </span>
            </div>
          ) : (
            <span className="text-lg font-light text-white/40 mt-2">No Runs</span>
          )}
          <span className="text-[10px] font-mono text-white/30 mt-1">
            {lastSync ? new Date(lastSync.timestamp).toLocaleString() : "—"}
          </span>
        </div>

        <div className="border border-white/10 bg-white/[0.015] p-5 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Job Success Rate</span>
          <div className="text-2xl font-light text-white mt-2">
            {logs.length > 0 ? `${Math.round((totalSuccess / logs.length) * 100)}%` : "—"}
          </div>
          <span className="text-[10px] font-mono text-white/30 mt-1">
            {totalSuccess} OK / {totalFailure} failed
          </span>
        </div>

        <div className="border border-white/10 bg-white/[0.015] p-5 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono">New Data Synced</span>
          <div className="text-2xl font-light text-emerald-400 mt-2">
            +{totalAdded.toLocaleString()}
          </div>
          <span className="text-[10px] font-mono text-white/30 mt-1">
            records inserted (last 80 steps)
          </span>
        </div>

        <div className="border border-white/10 bg-white/[0.015] p-5 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Updates Applied</span>
          <div className="text-2xl font-light text-blue-400 mt-2">
            {totalUpdated.toLocaleString()}
          </div>
          <span className="text-[10px] font-mono text-white/30 mt-1">
            records updated (last 80 steps)
          </span>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border border-white/10 bg-[#05070f] p-4">
        <form onSubmit={handleSearch} className="relative w-full sm:w-72 flex gap-2">
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search by job name or error..."
            className="w-full bg-black/60 border border-white/15 px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-[var(--color-space-accent-2)]"
          />
          <button type="submit" className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs border border-white/15 transition-colors">
            Search
          </button>
        </form>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <span className="text-[10px] font-mono uppercase text-white/40 mr-2">Filter status</span>
          {(["all", "success", "failure"] as const).map((st) => (
            <button
              key={st}
              onClick={() => { setFilterStatus(st); setPage(1); }}
              className={`text-[10px] uppercase tracking-wider px-2.5 py-1 border transition-colors ${
                filterStatus === st
                  ? "bg-white text-black border-white"
                  : "border-white/10 text-white/60 hover:text-white hover:border-white/30"
              }`}
            >
              {st}
            </button>
          ))}
          <button
            onClick={() => fetchLogs(page, filterQuery, filterStatus)}
            disabled={loading}
            className="text-[10px] uppercase tracking-wider px-3 py-1 bg-white/[0.06] border border-white/15 hover:bg-white/10 text-white transition-colors ml-4"
          >
            {loading ? "Syncing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── Audit Logs List ── */}
      <div className="border border-white/10 bg-[#04060a] divide-y divide-white/10">
        {logs.map((log) => {
          const isExpanded = expandedId === log.id;
          const hasDetails = log.details && Object.keys(log.details).length > 0;
          const relativeTime = new Date(log.timestamp).toLocaleString();
          const detailsList = log.details || {};

          return (
            <div key={log.id} className="transition-colors hover:bg-white/[0.005]">
              <div
                onClick={() => toggleExpand(log.id)}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <span
                    className={`text-[9px] font-mono tracking-widest uppercase border px-2 py-0.5 mt-0.5 shrink-0 ${getJobBadgeColor(
                      log.job_name
                    )}`}
                  >
                    {log.job_name}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-light text-white flex items-center gap-2">
                      {log.job_name === "refresh-run" ? "Refresh Job Execution" : `Sync Step: ${log.job_name}`}
                      <span className="text-white/30 font-mono text-[10px]">· {relativeTime}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 font-mono text-xs">
                  <div className="flex gap-4">
                    <span className={log.records_added > 0 ? "text-emerald-400" : "text-white/30"}>
                      +{log.records_added}
                    </span>
                    <span className={log.records_updated > 0 ? "text-blue-400" : "text-white/30"}>
                      {log.records_updated} mod
                    </span>
                  </div>

                  <span
                    className={`text-[9px] uppercase tracking-widest px-2 py-0.5 border ${
                      log.status === "success"
                        ? "border-emerald-500/20 text-emerald-400"
                        : "border-red-500/20 text-red-400 animate-pulse"
                    }`}
                  >
                    {log.status}
                  </span>
                  <span className="text-white/30">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* Expanded details section */}
              {isExpanded && (
                <div className="p-5 bg-black/40 border-t border-white/5 space-y-4 text-xs font-mono text-white/75">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-1">
                        Step Telemetry
                      </h4>
                      <div className="space-y-1">
                        <div>Step Name: <span className="text-white">{log.job_name}</span></div>
                        <div>Status: <span className={log.status === "success" ? "text-emerald-400" : "text-red-400"}>{log.status}</span></div>
                        <div>Timestamp: <span className="text-white">{log.timestamp}</span></div>
                        {detailsList.duration_seconds !== undefined && (
                          <div>Duration: <span className="text-[var(--color-space-accent-2)]">{detailsList.duration_seconds} seconds</span></div>
                        )}
                      </div>
                    </div>

                    {/* Metadata details mapping */}
                    <div>
                      <h4 className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-1">
                        Transfer Details
                      </h4>
                      <div className="space-y-1">
                        {log.job_name.startsWith("tle-") && (
                          <>
                            <div>Group: <span className="text-white">{log.job_name.replace("tle-", "")}</span></div>
                            <div>Source API: <span className="text-white">CelesTrak GP-Data</span></div>
                            {detailsList.total_fetched !== undefined && (
                              <div>Total TLEs fetched: <span className="text-white">{detailsList.total_fetched}</span></div>
                            )}
                            {detailsList.tle_snapshots_added !== undefined && (
                              <div>Snapshots created: <span className="text-white">{detailsList.tle_snapshots_added}</span></div>
                            )}
                          </>
                        )}
                        {log.job_name === "launches" && (
                          <>
                            <div>Source API: <span className="text-white">Launch Library 2 (LL2)</span></div>
                            <div>Lookback Window: <span className="text-white">45 days</span></div>
                          </>
                        )}
                        {log.job_name === "news" && (
                          <>
                            <div>Source API: <span className="text-white">Spaceflight News API (SNAPI)</span></div>
                            {detailsList.links_created !== undefined && (
                              <div>Links created: <span className="text-white">{detailsList.links_created}</span></div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Added Items List */}
                  {detailsList.added_items && Array.isArray(detailsList.added_items) && detailsList.added_items.length > 0 && (
                    <div>
                      <h4 className="text-[10px] uppercase tracking-widest text-emerald-400/80 font-semibold mb-2">
                        Added Records ({detailsList.added_items.length})
                      </h4>
                      <div className="max-h-32 overflow-y-auto bg-black/60 border border-white/5 p-2.5 rounded divide-y divide-white/5 space-y-1 font-sans text-xs">
                        {detailsList.added_items.map((item: string, index: number) => (
                          <div key={index} className="text-white/80 py-1">{item}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Updated Items List */}
                  {detailsList.updated_items && Array.isArray(detailsList.updated_items) && detailsList.updated_items.length > 0 && (
                    <div>
                      <h4 className="text-[10px] uppercase tracking-widest text-blue-400/80 font-semibold mb-2">
                        Updated Records ({detailsList.updated_items.length})
                      </h4>
                      <div className="max-h-32 overflow-y-auto bg-black/60 border border-white/5 p-2.5 rounded divide-y divide-white/5 space-y-1 font-sans text-xs">
                        {detailsList.updated_items.map((item: string, index: number) => (
                          <div key={index} className="text-white/80 py-1">{item}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Launches detailed statistics */}
                  {log.job_name === "launches" && detailsList.agencies && (
                    <div className="space-y-3">
                      <h4 className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">
                        Component Counts
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {["agencies", "rockets", "launch_sites", "launches"].map((k) => {
                          const val = detailsList[k] || { added: 0, updated: 0 };
                          return (
                            <div key={k} className="border border-white/5 bg-black/20 p-2 text-center">
                              <span className="text-[9px] uppercase tracking-wider text-white/30 block">{k}</span>
                              <span className="text-emerald-400 font-bold">+{val.added || 0}</span>
                              <span className="text-white/30 text-[10px] ml-1">/</span>
                              <span className="text-blue-400 font-bold ml-1">{val.updated || 0}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Error Output */}
                  {detailsList.error && (
                    <div className="border border-red-500/20 bg-red-500/5 p-3 text-red-400">
                      <div className="text-[10px] uppercase tracking-widest font-semibold mb-1">Execution Error</div>
                      <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{detailsList.error}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {logs.length === 0 && (
          <div className="text-center py-16 text-white/30 text-xs italic">
            No matching database sync logs found
          </div>
        )}
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 flex items-center justify-between border-t border-white/10 bg-black/40">
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
              Page {page} of {totalPages} ({total} total records)
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 text-[10px] uppercase tracking-widest text-white transition-colors disabled:opacity-30 border border-white/10"
              >
                Previous
              </button>
              <button 
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 text-[10px] uppercase tracking-widest text-white transition-colors disabled:opacity-30 border border-white/10"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
