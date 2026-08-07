"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/clientApi";

interface Payload {
  id: string;
  slug: string;
  name: string;
  constellation: string;
  orbit_type: string;
  purpose: string;
}

export function ClientRocketPayloads({ rocketId, initialPayloads }: { rocketId: string, initialPayloads: Payload[] }) {
  const [payloads, setPayloads] = useState<Payload[]>(initialPayloads);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(initialPayloads.length);
  const [hasMore, setHasMore] = useState(initialPayloads.length === 60);

  const loadMore = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/v1/rockets/${rocketId}/payloads?limit=60&offset=${offset}`);
      if (!res.ok) throw new Error("Failed to fetch payloads");
      const data = await res.json();
      
      setPayloads((prev) => [...prev, ...data]);
      setOffset((prev) => prev + data.length);
      
      if (data.length < 60) {
        setHasMore(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (payloads.length === 0) return null;

  return (
    <section className="mt-16">
      <div className="flex items-center justify-between mb-5 border-b border-white/10 pb-3">
        <h2 className="text-[11px] tracking-[0.3em] uppercase text-white/45">
          Payloads it launched
        </h2>
        <div className="text-[11px] tracking-[0.2em] uppercase text-[var(--color-space-accent-2)] font-mono">
          {payloads.length} loaded
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5">
        {payloads.map((s, idx) => (
          <Link
            key={s.id + idx}
            href={`/satellites/${s.slug}`}
            className="group bg-[#06080f] p-4 hover:bg-[#0c1322] transition-colors"
          >
            <div className="font-light truncate group-hover:text-[var(--color-space-accent-2)] transition-colors">
              {s.name}
            </div>
            <div className="text-[11px] text-white/40 font-mono uppercase tracking-wide mt-1">
              {s.constellation ? `${s.constellation} · ` : ""}
              {s.orbit_type ?? s.purpose ?? "payload"}
            </div>
          </Link>
        ))}
      </div>
      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-3 text-[10px] tracking-[0.2em] uppercase border border-white/20 text-white font-mono hover:bg-white/[0.04] disabled:opacity-50 transition-all"
          >
            {loading ? "Loading..." : "Load More Payloads"}
          </button>
        </div>
      )}
    </section>
  );
}
