export const runtime = "edge";
import Link from "next/link";
import type { Metadata } from "next";
import { api, type Rocket } from "@/lib/api";
import { EmptyState, safe } from "@/components/EmptyState";
import { PageHeader, Chip } from "@/components/ui";
import { SafeImg } from "@/components/SafeImg";

export const metadata: Metadata = {
  title: "Rockets — Orbica",
  description: "Every orbital launch vehicle since 1957 — active and retired rockets with specifications, launch records and 3D models.",
};

const FILTERS: { key: string; label: string; test: (r: Rocket) => boolean }[] = [
  { key: "all", label: "All", test: () => true },
  { key: "active", label: "Active", test: (r) => r.status === "active" },
  { key: "retired", label: "Retired", test: (r) => r.status === "retired" },
  { key: "reusable", label: "Reusable", test: (r) => r.reusable },
];

function NoPhoto() {
  return (
    <div className="grid h-full w-full place-items-center font-mono text-[10px] uppercase tracking-[0.25em] text-ink-4/60">
      No photo
    </div>
  );
}

export default async function RocketsPage({ searchParams }: { searchParams: { filter?: string } }) {
  const rockets = await safe(api.rockets(), []);
  const active = FILTERS.find((f) => f.key === searchParams.filter) ?? FILTERS[0];
  const shown = rockets.filter(active.test);

  return (
    <div>
      <PageHeader
        eyebrow="The fleet"
        title="Rockets"
        meta={`${rockets.length.toLocaleString("en-US")} launch vehicles since 1957`}
        actions={
          <Link href="/compare" className="btn btn-secondary">
            Compare vehicles
          </Link>
        }
      />

      {rockets.length === 0 ? (
        <EmptyState message="The rocket catalogue is unavailable right now — please try again shortly." />
      ) : (
        <>
          <nav aria-label="Filter rockets" className="mb-6 flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const on = f.key === active.key;
              const count = rockets.filter(f.test).length;
              return (
                <Link
                  key={f.key}
                  href={f.key === "all" ? "/rockets" : `/rockets?filter=${f.key}`}
                  aria-current={on ? "page" : undefined}
                  scroll={false}
                  className={`border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
                    on ? "border-white bg-white text-black" : "border-line-strong text-ink-3 hover:border-ink-4 hover:text-ink"
                  }`}
                >
                  {f.label} <span className={on ? "text-black/60" : "text-ink-4"}>{count}</span>
                </Link>
              );
            })}
          </nav>

          <div className="tile-grid sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((r) => {
              // Cards are ~400px wide: use the thumbnail rendition when we have
              // it — the originals run to several MB (one PNG is 2.5 MB).
              const img = r.thumbnail_url || r.image_url;
              return (
                <Link key={r.id} href={`/rockets/${r.slug}`} className="tile group defer-render">
                  <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-b from-[#0a1020] to-[#05070f]">
                    {img ? (
                      <SafeImg
                        src={img}
                        alt={r.name}
                        className="h-full w-full object-cover opacity-90 transition-[opacity,transform] duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
                        fallback={<NoPhoto />}
                      />
                    ) : (
                      <NoPhoto />
                    )}
                    <div className="absolute right-2 top-2 flex gap-1.5">
                      {r.reusable && <Chip tone="accent">Reusable</Chip>}
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-lg font-light leading-tight transition-colors group-hover:text-accent">{r.name}</span>
                      <span className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] ${r.status === "active" ? "text-success" : "text-ink-4"}`}>
                        {r.status ?? "unknown"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px] text-ink-3">
                      <span>{r.total_launches} launches</span>
                      {r.height_m && <span>{r.height_m} m</span>}
                      {r.payload_leo_kg && <span>{Number(r.payload_leo_kg).toLocaleString("en-US")} kg → LEO</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
