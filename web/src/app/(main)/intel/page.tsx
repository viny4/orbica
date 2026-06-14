import Link from "next/link";
import { api } from "@/lib/api";
import { safe } from "@/components/EmptyState";
import { Eyebrow } from "@/components/ui";

export const metadata = { title: "Space Intelligence — Orbica" };

function fmtT(d?: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short",
  });
}

const KIND_COLOR: Record<string, string> = {
  storm: "text-amber-400 border-amber-400/40",
  reentry: "text-red-400 border-red-400/40",
  conjunction: "text-[var(--color-space-accent-2)] border-[var(--color-space-accent-2)]/40",
  deployment: "text-emerald-400 border-emerald-400/40",
};

function stormTone(state?: string) {
  if (!state) return "text-white/60";
  if (state.includes("G5") || state.includes("G4")) return "text-red-400";
  if (state.includes("Storm")) return "text-amber-400";
  if (state === "Active" || state === "Unsettled") return "text-yellow-300/80";
  return "text-emerald-400";
}

export default async function IntelPage() {
  const [weather, events, conjunctions, reentries] = await Promise.all([
    safe<Record<string, any> | null>(api.intelSpaceWeather(), null),
    safe(api.intelEvents(), []),
    safe(api.intelConjunctions(), []),
    safe(api.intelReentries(), []),
  ]);

  const imminent = reentries.filter((r) => r.status === "imminent");

  return (
    <div>
      <Eyebrow>Computed in-house · live</Eyebrow>
      <h1 className="mt-4 mb-3 font-light uppercase leading-[0.95] tracking-tight text-5xl sm:text-6xl">
        Space Intelligence
      </h1>
      <p className="max-w-2xl text-white/50 font-light mb-12">
        Original analysis generated from our own catalogue — close-approach screening, reentry decay,
        and live space weather. Not news; numbers.
      </p>

      {/* Space weather banner */}
      {weather && (
        <div className="border border-white/10 bg-[#06080f] p-6 mb-10 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <div className="text-[10px] tracking-[0.3em] uppercase text-white/40 mb-2">Geomagnetic conditions</div>
            <div className={`text-3xl font-light ${stormTone(weather.kp_state)}`}>
              Kp {Number(weather.kp).toFixed(1)} · {weather.kp_state}
            </div>
            <p className="mt-2 text-sm text-white/50">{weather.note}</p>
          </div>
          {weather.solar_wind_kms && (
            <div className="text-right">
              <div className="text-[10px] tracking-[0.3em] uppercase text-white/40 mb-1">Solar wind</div>
              <div className="text-2xl font-light font-mono">{Math.round(weather.solar_wind_kms)} km/s</div>
            </div>
          )}
        </div>
      )}

      {/* Event feed */}
      {events.length > 0 && (
        <section className="mb-12">
          <h2 className="text-[11px] tracking-[0.3em] uppercase text-white/45 mb-4 border-b border-white/10 pb-3">
            Event feed
          </h2>
          <ul className="space-y-2">
            {events.slice(0, 8).map((e, i) => (
              <li key={i} className="flex items-start gap-3 py-2">
                <span className={`text-[9px] tracking-[0.18em] uppercase px-2 py-0.5 border mt-0.5 ${KIND_COLOR[e.kind] ?? "text-white/40 border-white/15"}`}>
                  {e.kind}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-light">{e.title}</div>
                  <div className="text-[12px] text-white/40">{e.detail} · {fmtT(e.occurred_at)}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Conjunction watch */}
        <section>
          <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
            <h2 className="text-[11px] tracking-[0.3em] uppercase text-white/45">Conjunction watch</h2>
            <Link href="/intel/conjunctions" className="text-[10px] tracking-[0.2em] uppercase text-[var(--color-space-accent-2)]/80 hover:text-[var(--color-space-accent-2)]">
              All {conjunctions.length} →
            </Link>
          </div>
          <ul className="divide-y divide-white/10 border-y border-white/10">
            {conjunctions.slice(0, 8).map((c, i) => (
              <li key={i} className="py-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-light truncate">
                    <Conj slug={c.sat_a_slug} name={c.sat_a_name} /> <span className="text-white/30">⇄</span> <Conj slug={c.sat_b_slug} name={c.sat_b_name} />
                  </span>
                  <span className={`font-mono flex-shrink-0 ${c.miss_km < 1 ? "text-red-400" : "text-white/70"}`}>{Number(c.miss_km).toFixed(2)} km</span>
                </div>
                <div className="text-[11px] text-white/35 font-mono mt-0.5">{Math.round(c.rel_speed_kms)} km/s · {fmtT(c.tca)}</div>
              </li>
            ))}
          </ul>
        </section>

        {/* Reentry watch */}
        <section>
          <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
            <h2 className="text-[11px] tracking-[0.3em] uppercase text-white/45">
              Reentry watch {imminent.length > 0 && <span className="text-red-400">· {imminent.length} imminent</span>}
            </h2>
            <Link href="/intel/reentry" className="text-[10px] tracking-[0.2em] uppercase text-[var(--color-space-accent-2)]/80 hover:text-[var(--color-space-accent-2)]">
              All →
            </Link>
          </div>
          <ul className="divide-y divide-white/10 border-y border-white/10">
            {reentries.slice(0, 8).map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="font-light truncate">
                  {r.slug ? <Link href={`/satellites/${r.slug}`} className="hover:text-[var(--color-space-accent-2)]">{r.name}</Link> : r.name}
                </span>
                <span className="flex items-center gap-3 flex-shrink-0 font-mono">
                  <span className="text-white/60">{Math.round(r.perigee_km)} km</span>
                  <span className={`text-[10px] uppercase tracking-[0.15em] ${r.status === "imminent" ? "text-red-400" : r.status === "decaying" ? "text-amber-400" : "text-white/40"}`}>{r.status}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Conj({ slug, name }: { slug?: string | null; name: string }) {
  return slug ? (
    <Link href={`/satellites/${slug}`} className="hover:text-[var(--color-space-accent-2)]">{name}</Link>
  ) : (
    <span>{name}</span>
  );
}
