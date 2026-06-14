import Link from "next/link";
import { api } from "@/lib/api";
import { EmptyState, safe } from "@/components/EmptyState";
import { PageHeader, Chip } from "@/components/ui";
import { SafeImg } from "@/components/SafeImg";

export const metadata = { title: "Rockets — Orbica" };

function NoPhoto() {
  return (
    <div className="w-full h-full grid place-items-center text-white/15 text-[10px] tracking-[0.25em] uppercase">
      No photo
    </div>
  );
}

export default async function RocketsPage() {
  const rockets = await safe(api.rockets(), []);

  return (
    <div>
      <PageHeader eyebrow="The Fleet" title="Rockets" meta={`${rockets.length} launch vehicles`} />

      {rockets.length === 0 ? (
        <EmptyState message="No rockets yet — run the seed to populate from Launch Library 2." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5">
          {rockets.map((r) => (
            <Link
              key={r.id}
              href={`/rockets/${r.slug}`}
              className="group block bg-[#06080f] hover:bg-[#0c1322] transition-colors"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-b from-[#0a1020] to-[#05070f]">
                {r.image_url ? (
                  <SafeImg
                    src={r.image_url}
                    alt={r.name}
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-[1.03] transition-all duration-500"
                    fallback={<NoPhoto />}
                  />
                ) : (
                  <NoPhoto />
                )}
                {r.reusable && (
                  <div className="absolute top-2 right-2">
                    <Chip tone="accent">Reusable</Chip>
                  </div>
                )}
              </div>
              <div className="p-5">
                <span className="font-light text-lg leading-tight group-hover:text-[var(--color-space-accent-2)] transition-colors">
                  {r.name}
                </span>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-white/45 font-mono">
                  <span>{r.status ?? "unknown"}</span>
                  <span>{r.total_launches} launches</span>
                  {r.height_m && <span>{r.height_m} m</span>}
                  {r.payload_leo_kg && <span>{Number(r.payload_leo_kg).toLocaleString()} kg → LEO</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
