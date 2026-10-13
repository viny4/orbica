export const runtime = "edge";
import Link from "next/link";
import { api } from "@/lib/api";
import { safe } from "@/components/EmptyState";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Conjunction Watch — Orbica" };

function fmtT(d?: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
  });
}

export default async function ConjunctionsPage() {
  const items = await safe(api.intelConjunctions(), []);
  return (
    <div>
      <PageHeader
        eyebrow="Space Intelligence · screened"
        title="Conjunction Watch"
        meta={`${items.length} close approaches in the next 3 hours`}
        back={{ href: "/intel", label: "Intelligence" }}
      />
      <p className="-mt-6 mb-10 max-w-2xl text-ink-3 font-light text-sm">
        Independent objects passing within 10 km, screened across the whole tracked catalogue (co-deployed
        formations and docked craft excluded). Sampled at 30-second steps — a screening pass, not a refined
        TCA solution.
      </p>
      <ul className="border-t border-line">
        {items.map((c, i) => (
          <li key={i} className="flex items-center justify-between gap-4 py-4 border-b border-line">
            <div className="min-w-0">
              <div className="font-light truncate">
                {c.sat_a_slug ? <Link href={`/satellites/${c.sat_a_slug}`} className="hover:text-accent">{c.sat_a_name}</Link> : c.sat_a_name}
                <span className="text-ink-4 mx-2">⇄</span>
                {c.sat_b_slug ? <Link href={`/satellites/${c.sat_b_slug}`} className="hover:text-accent">{c.sat_b_name}</Link> : c.sat_b_name}
              </div>
              <div className="text-[12px] text-ink-4 font-mono mt-0.5">
                {Math.round(c.rel_speed_kms)} km/s relative · {fmtT(c.tca)}
              </div>
            </div>
            <div className={`font-mono text-lg flex-shrink-0 ${c.miss_km < 1 ? "text-danger" : c.miss_km < 5 ? "text-warning" : "text-ink-2"}`}>
              {Number(c.miss_km).toFixed(2)} km
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
