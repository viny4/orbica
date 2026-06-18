import Link from "next/link";
import { api } from "@/lib/api";
import { safe } from "@/components/EmptyState";
import { Eyebrow, Chip } from "@/components/ui";

export const metadata = { title: "Space Intelligence — Orbica" };

function fmtT(d?: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

const KIND_COLOR: Record<string, string> = {
  storm: "text-amber-400 border-amber-400/30 bg-amber-500/5",
  reentry: "text-red-400 border-red-400/30 bg-red-500/5",
  conjunction: "text-[var(--color-space-accent-2)] border-[var(--color-space-accent-2)]/30 bg-cyan-500/5",
  deployment: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5",
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
    <div className="space-y-10">
      <div>
        <Eyebrow>Computed operations intelligence &middot; live telemetry</Eyebrow>
        <h1 className="mt-4 mb-3 font-light uppercase leading-[0.95] tracking-tight text-5xl sm:text-6xl">
          Space Intelligence
        </h1>
        <p className="max-w-2xl text-white/50 font-light text-xs sm:text-sm">
          Computed telemetry analysis: close approach junctions, orbital decays, and geomagnetic solar wind monitoring.
        </p>
      </div>

      {/* Space weather banner */}
      {weather && (
        <div className="border border-white/10 bg-[#06080f] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
          <div className="flex-1 space-y-1">
            <div className="text-[9px] tracking-[0.3em] uppercase text-white/40 font-mono">Geomagnetic storm watch</div>
            <div className={`text-2xl sm:text-3xl font-light flex items-center gap-3 ${stormTone(weather.kp_state)}`}>
              <span className={`w-3.5 h-3.5 rounded-full ${Number(weather.kp) > 4 ? "bg-amber-400 animate-ping" : "bg-emerald-400 animate-pulse"}`} />
              Kp {Number(weather.kp).toFixed(1)} &middot; {weather.kp_state || "Nominal"}
            </div>
            <p className="text-xs text-white/50 font-light leading-relaxed max-w-xl">{weather.note}</p>
          </div>
          {weather.solar_wind_kms && (
            <div className="text-left sm:text-right border-t sm:border-t-0 sm:border-l border-white/10 pt-4 sm:pt-0 sm:pl-6 shrink-0 font-mono">
              <div className="text-[9px] tracking-[0.3em] uppercase text-white/40 mb-1">Solar wind velocity</div>
              <div className="text-2xl font-light text-white">{Math.round(weather.solar_wind_kms)} km/s</div>
            </div>
          )}
        </div>
      )}

      {/* Main dashboard columns */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_42%] gap-8 items-stretch">
        
        {/* Left column: Event Feed & Conjunction watch */}
        <div className="space-y-10">
          
          {/* Conjunction watch */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-[10px] tracking-[0.25em] uppercase text-white/45 font-mono">Conjunction Watch</h2>
              <Link href="/intel/conjunctions" className="text-[10px] tracking-[0.15em] uppercase text-[var(--color-space-accent-2)]/80 hover:underline">
                All {conjunctions.length} approach alerts &rarr;
              </Link>
            </div>
            
            <div className="border border-white/10 bg-[#04060b] divide-y divide-white/5 font-mono text-xs">
              {conjunctions.slice(0, 8).map((c, i) => {
                const isHighRisk = c.miss_km < 1.0;
                return (
                  <div key={i} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.005]">
                    <div className="min-w-0">
                      <div className="font-sans text-sm font-light text-white truncate flex items-center gap-2">
                        <Conj slug={c.sat_a_slug} name={c.sat_a_name} />
                        <span className="text-white/30">&harr;</span>
                        <Conj slug={c.sat_b_slug} name={c.sat_b_name} />
                      </div>
                      <div className="text-[10px] text-white/35 mt-1">
                        Rel Velocity: {Math.round(c.rel_speed_kms)} km/s &middot; TCA: {fmtT(c.tca)}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                      <span className={`px-2 py-0.5 border text-[9px] uppercase tracking-wider ${isHighRisk ? "border-red-500/20 text-red-400 animate-pulse bg-red-500/5" : "border-white/10 text-white/50"}`}>
                        {isHighRisk ? "High Risk" : "Safe"}
                      </span>
                      <span className={`font-semibold text-right w-20 ${isHighRisk ? "text-red-400 font-bold" : "text-white/85"}`}>
                        {Number(c.miss_km).toFixed(2)} km
                      </span>
                    </div>
                  </div>
                );
              })}
              {conjunctions.length === 0 && (
                <div className="p-6 text-center text-white/30 italic">No conjunction entries available.</div>
              )}
            </div>
          </section>

          {/* Event feed */}
          {events.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-[10px] tracking-[0.25em] uppercase text-white/45 font-mono border-b border-white/10 pb-3">
                Operations Event Feed
              </h2>
              <ul className="space-y-3">
                {events.slice(0, 6).map((e, i) => (
                  <li key={i} className="border border-white/10 bg-white/[0.01] p-4 flex gap-3.5 items-start">
                    <span className={`text-[8px] font-mono tracking-widest uppercase px-2 py-1 border shrink-0 ${KIND_COLOR[e.kind] || "text-white/40 border-white/15"}`}>
                      {e.kind}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-light text-white">{e.title}</div>
                      <div className="text-xs text-white/40 mt-1">{e.detail}</div>
                      <div className="text-[10px] font-mono text-white/30 mt-1.5">{fmtT(e.occurred_at)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

        </div>

        {/* Right column: Reentry watch */}
        <div>
          <section className="space-y-4 h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-[10px] tracking-[0.25em] uppercase text-white/45 font-mono">
                Decay Reentry Watch
              </h2>
              {imminent.length > 0 && (
                <span className="text-red-400 font-mono text-[9px] uppercase animate-pulse">
                  &bull; {imminent.length} imminent
                </span>
              )}
            </div>

            <div className="border border-white/10 bg-[#04060b] divide-y divide-white/5 font-mono text-xs flex-1">
              {reentries.slice(0, 10).map((r, i) => {
                const isImminent = r.status === "imminent";
                return (
                  <div key={i} className="p-4 flex items-center justify-between gap-3 hover:bg-white/[0.005]">
                    <div className="min-w-0">
                      <div className="font-sans text-sm font-light text-white truncate">
                        {r.slug ? (
                          <Link href={`/satellites/${r.slug}`} className="hover:text-[var(--color-space-accent-2)]">
                            {r.name}
                          </Link>
                        ) : (
                          r.name
                        )}
                      </div>
                      <div className="text-[10px] text-white/35 mt-1">
                        Altitude Perigee: {Math.round(r.perigee_km)} km
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 border text-[9px] uppercase tracking-wider ${isImminent ? "border-red-500/20 text-red-400 bg-red-500/5 animate-pulse" : r.status === "decaying" ? "border-amber-500/20 text-amber-400" : "border-white/10 text-white/40"}`}>
                      {r.status}
                    </span>
                  </div>
                );
              })}
              {reentries.length === 0 && (
                <div className="p-6 text-center text-white/30 italic">No decaying spacecraft tracked.</div>
              )}
            </div>
          </section>
        </div>

      </div>
    </div>
  );
}

function Conj({ slug, name }: { slug?: string | null; name: string }) {
  return slug ? (
    <Link href={`/satellites/${slug}`} className="hover:text-[var(--color-space-accent-2)] transition-colors">
      {name}
    </Link>
  ) : (
    <span>{name}</span>
  );
}
