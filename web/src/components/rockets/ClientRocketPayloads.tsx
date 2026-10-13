"use client";

import { useState } from "react";
import Link from "next/link";
import { apiJSON } from "@/lib/clientApi";
import { SectionHeader } from "@/components/ui";

interface Payload {
  id: string;
  slug: string;
  name: string;
  constellation: string | null;
  orbit_type: string | null;
  purpose: string | null;
}

const PAGE = 60;

export function ClientRocketPayloads({ rocketId, initialPayloads }: { rocketId: string; initialPayloads: Payload[] }) {
  const [payloads, setPayloads] = useState<Payload[]>(initialPayloads);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hasMore, setHasMore] = useState(initialPayloads.length === PAGE);

  const loadMore = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const data = await apiJSON<Payload[]>(`/api/v1/rockets/${rocketId}/payloads?limit=${PAGE}&offset=${payloads.length}`);
      setPayloads((prev) => [...prev, ...data]);
      if (data.length < PAGE) setHasMore(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  if (payloads.length === 0) return null;

  return (
    <section className="mt-16">
      <SectionHeader title="Payloads it launched" count={payloads.length} />
      <div className="tile-grid sm:grid-cols-2 lg:grid-cols-3">
        {payloads.map((s, idx) => (
          <Link key={s.id + idx} href={`/satellites/${s.slug}`} className="tile group p-4">
            <div className="truncate font-light transition-colors group-hover:text-accent">{s.name}</div>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-wide text-ink-4">
              {s.constellation ? `${s.constellation} · ` : ""}
              {s.orbit_type ?? s.purpose ?? "payload"}
            </div>
          </Link>
        ))}
      </div>
      {(hasMore || failed) && (
        <div className="mt-6 flex flex-col items-center gap-3">
          {failed && <p className="text-sm text-ink-3">Couldn&apos;t load more payloads.</p>}
          <button onClick={loadMore} disabled={loading} className="btn btn-secondary disabled:opacity-50">
            {loading ? "Loading…" : failed ? "Try again" : "Load more payloads"}
          </button>
        </div>
      )}
    </section>
  );
}
