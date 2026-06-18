export const runtime = "edge";
import Link from "next/link";
import { api } from "@/lib/api";
import { safe } from "@/components/EmptyState";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Reentry Watch — Orbica" };

const STATUS_COLOR: Record<string, string> = {
  imminent: "text-red-400",
  decaying: "text-amber-400",
  low: "text-white/45",
};

export default async function ReentryPage() {
  const items = await safe(api.intelReentries(), []);
  return (
    <div>
      <PageHeader
        eyebrow="Space Intelligence · decay"
        title="Reentry Watch"
        meta={`${items.length} objects with decaying orbits`}
        back={{ href: "/intel", label: "Intelligence" }}
      />
      <p className="-mt-6 mb-10 max-w-2xl text-white/50 font-light text-sm">
        Objects whose perigee has dropped low enough that atmospheric drag is pulling them down. Perigee
        comes straight from each object&apos;s orbital elements; below ~120 km an object can no longer stay
        in orbit.
      </p>
      <ul className="border-t border-white/10">
        {items.map((r, i) => (
          <li key={i} className="flex items-center justify-between gap-4 py-4 border-b border-white/10">
            <div className="min-w-0">
              <div className="font-light truncate">
                {r.slug ? <Link href={`/satellites/${r.slug}`} className="hover:text-[var(--color-space-accent-2)]">{r.name}</Link> : r.name}
              </div>
              <div className="text-[12px] text-white/40 font-mono mt-0.5">
                perigee {Math.round(r.perigee_km)} km · apogee {Math.round(r.apogee_km)} km
                {r.est_days ? ` · ~${Number(r.est_days).toFixed(1)} days est.` : ""}
              </div>
            </div>
            <span className={`text-[11px] uppercase tracking-[0.2em] font-mono flex-shrink-0 ${STATUS_COLOR[r.status] ?? "text-white/40"}`}>
              {r.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
