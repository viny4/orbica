"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Html, Line } from "@react-three/drei";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Earth } from "@/components/three/Earth";
import { latLngAltToVec3, orbitPath, propagateTLE, type GeoPos } from "@/components/three/geo";
import { useInView } from "@/components/three/useInView";

interface LivePos {
  norad_id: number;
  name: string;
  lat: number;
  lng: number;
  altitude_km: number;
  velocity_km_s: number;
}
interface Meta {
  id: string; // slug
  name: string;
  purpose: string | null;
  constellation: string | null;
  owner: string | null;
  orbit: string | null;
}
interface Tracked {
  norad: number;
  name: string;
  slug: string;
  line1: string;
  line2: string;
}

type ColorMode = "orbit" | "purpose" | "constellation";

const BAND_COLORS: Record<string, string> = { LEO: "#7df9ff", MEO: "#ffd166", GEO: "#ff6b9d" };
const band = (a: number) => (a < 2000 ? "LEO" : a < 30000 ? "MEO" : "GEO");
const PURPOSE_COLORS: Record<string, string> = {
  Communications: "#7df9ff", Navigation: "#ffd166", Weather: "#9b8cff",
  "Earth Observation": "#6ee7a8", "Space Telescope": "#ff9e64",
  "Human Spaceflight": "#ff6b9d", "Planetary Science": "#c792ea", Technology: "#8aa0c8",
};
const CONSTELLATION_COLORS: Record<string, string> = {
  Starlink: "#7df9ff", OneWeb: "#ffd166", GPS: "#6ee7a8", Galileo: "#9b8cff",
  Iridium: "#ff9e64", Globalstar: "#ff6b9d",
};
const DIM = "#36456a";

function colorFor(mode: ColorMode, p: LivePos, m?: Meta): string {
  if (mode === "orbit") return BAND_COLORS[band(p.altitude_km)];
  if (mode === "purpose") return (m?.purpose && PURPOSE_COLORS[m.purpose]) || DIM;
  return (m?.constellation && CONSTELLATION_COLORS[m.constellation]) || DIM;
}
function categoryOf(mode: ColorMode, p: LivePos, m?: Meta): string {
  if (mode === "orbit") return band(p.altitude_km);
  if (mode === "purpose") return m?.purpose || "Other";
  return m?.constellation || "Other";
}

// ── live stream ──────────────────────────────────────────────────────────────
function useTrackerStream() {
  const [positions, setPositions] = useState<LivePos[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "down">("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const offsetRef = useRef(0);
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_TRACKER_WS_URL || "ws://localhost:7788";
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout>;
    const connect = () => {
      try {
        ws = new WebSocket(`${url}/ws`);
      } catch {
        setStatus("down");
        return;
      }
      wsRef.current = ws;
      ws.onopen = () => {
        setStatus("live");
        ws?.send(JSON.stringify({ action: "subscribe_all" }));
        if (offsetRef.current) ws?.send(JSON.stringify({ action: "set_time", offset_seconds: offsetRef.current }));
      };
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data) as LivePos[];
          if (Array.isArray(d) && d.length) setPositions(d);
        } catch { /* ignore */ }
      };
      ws.onclose = () => { setStatus("down"); retry = setTimeout(connect, 3000); };
      ws.onerror = () => ws?.close();
    };
    connect();
    return () => { clearTimeout(retry); ws?.close(); };
  }, []);
  const setOffset = useCallback((seconds: number) => {
    offsetRef.current = seconds;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action: "set_time", offset_seconds: seconds }));
  }, []);
  return { positions, status, setOffset };
}

function useMeta() {
  const [meta, setMeta] = useState<Map<number, Meta>>(new Map());
  useEffect(() => {
    fetch("/api/v1/track/meta").then((r) => (r.ok ? r.json() : [])).then((rows: any[]) => {
      const m = new Map<number, Meta>();
      for (const r of rows) m.set(r.norad, { id: r.id, name: r.name, purpose: r.purpose, constellation: r.constellation, owner: r.owner, orbit: r.orbit });
      setMeta(m);
    }).catch(() => {});
  }, []);
  return meta;
}

function sunDirection(now: Date): [number, number, number] {
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const doy = Math.floor((now.getTime() - start) / 86400000);
  const decl = -23.44 * Math.cos((2 * Math.PI / 365) * (doy + 10));
  const utc = now.getUTCHours() + now.getUTCMinutes() / 60;
  const lng = -15 * (utc - 12);
  const [x, y, z] = latLngAltToVec3(decl, lng, 0);
  return [x * 60, y * 60, z * 60];
}

// ── cloud ────────────────────────────────────────────────────────────────────
const dummy = new THREE.Object3D();
function SatelliteCloud({ positions, meta, mode, filter, dim, onPick }: {
  positions: LivePos[]; meta: Map<number, Meta>; mode: ColorMode; filter: string | null; dim: boolean;
  onPick: (p: LivePos) => void;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const shown = useMemo(
    () => (filter ? positions.filter((p) => categoryOf(mode, p, meta.get(p.norad_id)) === filter) : positions),
    [positions, filter, mode, meta],
  );
  const shownRef = useRef(shown);
  shownRef.current = shown;
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const col = new THREE.Color();
    shown.forEach((p, i) => {
      const [x, y, z] = latLngAltToVec3(p.lat, p.lng, p.altitude_km);
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      col.set(colorFor(mode, p, meta.get(p.norad_id)));
      if (dim) col.multiplyScalar(0.45);
      mesh.setColorAt(i, col);
    });
    mesh.count = shown.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [shown, mode, meta, dim]);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, Math.max(1, positions.length)]}
      onClick={(e) => { e.stopPropagation(); const id = e.instanceId; if (id != null && shownRef.current[id]) onPick(shownRef.current[id]); }}
    >
      <sphereGeometry args={[0.012, 6, 6]} />
      <meshBasicMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  );
}

// Orbit path + glowing marker for the tracked satellite, propagated client-side.
function TrackedSatellite({ line1, line2, offsetMin, onTelemetry }: {
  line1: string; line2: string; offsetMin: number; onTelemetry: (p: GeoPos) => void;
}) {
  const marker = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const acc = useRef(99);
  const orbit = useMemo(() => orbitPath(line1, line2, 240), [line1, line2]);
  useFrame((_, delta) => {
    acc.current += delta;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const p = propagateTLE(line1, line2, new Date(Date.now() + offsetMin * 60000));
    if (p && marker.current) {
      const v = latLngAltToVec3(p.lat, p.lng, p.altKm);
      marker.current.position.set(v[0], v[1], v[2]);
      glow.current?.position.set(v[0], v[1], v[2]);
      onTelemetry(p);
    }
  });
  return (
    <>
      {orbit.length > 1 && <Line points={orbit} color="#7df9ff" lineWidth={2} transparent opacity={0.85} />}
      <mesh ref={glow}><sphereGeometry args={[0.07, 16, 16]} /><meshBasicMaterial color="#7df9ff" transparent opacity={0.3} /></mesh>
      <mesh ref={marker}><sphereGeometry args={[0.032, 16, 16]} /><meshBasicMaterial color="#ffffff" /></mesh>
    </>
  );
}

// ── analytics ────────────────────────────────────────────────────────────────
function tally<T>(items: T[], key: (t: T) => string | null): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) { const k = key(it); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
const ALT_BINS = [
  ["< 400 km", 0, 400], ["400–550", 400, 550], ["550–700", 550, 700], ["700–1200", 700, 1200],
  ["1.2–2k", 1200, 2000], ["2–20k", 2000, 20000], ["20–36k", 20000, 36000], ["GEO+", 36000, 1e9],
] as const;
function Bars({ data, colorOf, onClick, active }: {
  data: [string, number][]; colorOf?: (k: string) => string; onClick?: (k: string) => void; active?: string | null;
}) {
  const max = Math.max(1, ...data.map((d) => d[1]));
  return (
    <div className="space-y-1.5">
      {data.map(([k, v]) => (
        <button key={k} onClick={() => onClick?.(k)} disabled={!onClick}
          className={`w-full text-left ${active === k ? "opacity-100" : active ? "opacity-40" : "opacity-100"}`}>
          <div className="flex items-center justify-between text-[10px] font-mono tracking-wide mb-0.5">
            <span className="flex items-center gap-1.5 text-white/70 truncate">
              {colorOf && <span className="inline-block w-2 h-2 rounded-full" style={{ background: colorOf(k) }} />}{k}
            </span>
            <span className="text-white/40">{v.toLocaleString()}</span>
          </div>
          <div className="h-1 bg-white/5"><div className="h-full transition-all" style={{ width: `${(v / max) * 100}%`, background: colorOf ? colorOf(k) : "#5b8cff" }} /></div>
        </button>
      ))}
    </div>
  );
}

// ── main ─────────────────────────────────────────────────────────────────────
export default function GlobalTracker() {
  const { positions, status, setOffset } = useTrackerStream();
  const meta = useMeta();
  const { ref, inView, armed } = useInView<HTMLDivElement>("0px");
  const [mode, setMode] = useState<ColorMode>("orbit");
  const [filter, setFilter] = useState<string | null>(null);
  const [tracked, setTracked] = useState<Tracked | null>(null);
  const [telemetry, setTelemetry] = useState<GeoPos | null>(null);
  const [query, setQuery] = useState("");
  const [showPanel, setShowPanel] = useState(true);

  const [offsetMin, setOffsetMin] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setClock(Date.now()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { setOffset(offsetMin * 60); }, [offsetMin, setOffset]);
  const shownTime = useMemo(() => new Date(clock + offsetMin * 60000), [clock, offsetMin]);
  const sun = useMemo(() => sunDirection(shownTime), [shownTime]);

  // search index (name → norad/slug) built once from metadata
  const index = useMemo(
    () => Array.from(meta.entries()).map(([norad, m]) => ({ norad, name: m.name, slug: m.id })),
    [meta],
  );
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return index.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, index]);

  const track = useCallback(async (norad: number) => {
    const m = meta.get(norad);
    if (!m) return;
    try {
      const r = await fetch(`/api/v1/satellites/${m.id}/tle`);
      if (!r.ok) return;
      const t = await r.json();
      if (t?.tle_line1 && t?.tle_line2) {
        setTracked({ norad, name: m.name, slug: m.id, line1: t.tle_line1, line2: t.tle_line2 });
        setTelemetry(null);
        setQuery("");
      }
    } catch { /* ignore */ }
  }, [meta]);

  const regime = useMemo(() => tally(positions, (p) => band(p.altitude_km)), [positions]);
  const purpose = useMemo(() => tally(positions, (p) => meta.get(p.norad_id)?.purpose ?? null).slice(0, 8), [positions, meta]);
  const country = useMemo(() => tally(positions, (p) => meta.get(p.norad_id)?.owner ?? null).slice(0, 6), [positions, meta]);
  const altHist = useMemo(() => {
    const counts = ALT_BINS.map(([label]) => [label, 0] as [string, number]);
    for (const p of positions) { const idx = ALT_BINS.findIndex(([, lo, hi]) => p.altitude_km >= lo && p.altitude_km < hi); if (idx >= 0) counts[idx][1]++; }
    return counts;
  }, [positions]);
  const colorOfCat = (k: string) => mode === "orbit" ? BAND_COLORS[k] ?? DIM : mode === "purpose" ? PURPOSE_COLORS[k] ?? DIM : CONSTELLATION_COLORS[k] ?? DIM;
  const modeData = mode === "orbit" ? regime : mode === "purpose" ? purpose : tally(positions, (p) => meta.get(p.norad_id)?.constellation ?? null).slice(0, 8);

  return (
    <div className={`grid gap-4 ${showPanel ? "lg:grid-cols-[300px_1fr]" : "grid-cols-1"}`}>
      {/* analytics sidebar */}
      {showPanel && (
        <aside className="order-2 lg:order-1 space-y-6 lg:max-h-[82vh] lg:overflow-y-auto pr-1">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className={`inline-block w-2 h-2 rounded-full ${status === "live" ? "bg-emerald-400" : status === "connecting" ? "bg-amber-400" : "bg-red-400"}`} />
            <span className="text-white/60">{status === "live" ? `${positions.length.toLocaleString()} live` : status}</span>
          </div>
          <div>
            <div className="text-[10px] tracking-[0.25em] uppercase text-white/40 mb-2">Colour by</div>
            <div className="flex gap-px bg-white/10">
              {(["orbit", "purpose", "constellation"] as ColorMode[]).map((m) => (
                <button key={m} onClick={() => { setMode(m); setFilter(null); }}
                  className={`flex-1 text-[10px] tracking-[0.1em] uppercase py-1.5 ${mode === m ? "bg-white text-black" : "bg-[#06080f] text-white/50 hover:text-white"}`}>{m}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] tracking-[0.25em] uppercase text-white/40 mb-2 flex justify-between">
              <span>{mode}</span>{filter && <button onClick={() => setFilter(null)} className="text-[var(--color-space-accent-2)]">clear</button>}
            </div>
            <Bars data={modeData} colorOf={colorOfCat} onClick={(k) => setFilter(filter === k ? null : k)} active={filter} />
          </div>
          <div><div className="text-[10px] tracking-[0.25em] uppercase text-white/40 mb-2">Altitude distribution</div><Bars data={altHist} /></div>
          <div><div className="text-[10px] tracking-[0.25em] uppercase text-white/40 mb-2">Top operators</div><Bars data={country} /></div>
        </aside>
      )}

      {/* globe — first on mobile (the main view), sidebar drops below it */}
      <div ref={ref} className="order-1 lg:order-2 relative h-[70vh] lg:h-[82vh] overflow-hidden border border-white/10 bg-black">
        {armed && (
          <Canvas camera={{ position: [0, 2, 7], fov: 45 }} dpr={[1, 2]} frameloop={inView ? "always" : "never"}>
            <ambientLight intensity={0.16} />
            <directionalLight position={sun} intensity={2} />
            <Suspense fallback={<Html center>Loading globe…</Html>}>
              <Stars radius={90} depth={50} count={4000} factor={4} fade />
              <Earth spin={false} />
              <SatelliteCloud positions={positions} meta={meta} mode={mode} filter={filter} dim={Boolean(tracked)} onPick={(p) => track(p.norad_id)} />
              {tracked && <TrackedSatellite line1={tracked.line1} line2={tracked.line2} offsetMin={offsetMin} onTelemetry={setTelemetry} />}
            </Suspense>
            <OrbitControls enablePan={false} minDistance={3.2} maxDistance={20} autoRotate={!tracked} autoRotateSpeed={0.18} />
          </Canvas>
        )}

        {/* search-to-track — sits below the stats toggle on mobile to avoid overlap */}
        <div className="absolute top-14 sm:top-3 left-1/2 -translate-x-1/2 w-[min(420px,92%)]">
          <div className="relative">
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Track a satellite — ISS, Hubble, Starlink…"
              className="w-full bg-black/70 backdrop-blur border border-white/15 focus:border-[var(--color-space-accent-2)] outline-none px-4 py-2.5 text-sm placeholder:text-white/30" />
            {results.length > 0 && (
              <ul className="absolute top-full mt-1 w-full bg-[#0a0e1a] border border-white/15 max-h-72 overflow-y-auto z-10">
                {results.map((s) => (
                  <li key={s.norad}>
                    <button onClick={() => track(s.norad)} className="w-full text-left px-4 py-2 text-sm hover:bg-white/[0.06] hover:text-[var(--color-space-accent-2)] flex justify-between">
                      <span className="truncate">{s.name}</span><span className="text-white/30 text-[11px] font-mono">{s.norad}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* tracked telemetry HUD */}
        {tracked && (
          <div className="absolute bottom-16 left-3 bg-black/70 backdrop-blur border border-[var(--color-space-accent-2)]/40 p-4 w-64">
            <div className="flex items-start justify-between gap-3">
              <span className="text-[var(--color-space-accent-2)] font-semibold text-sm">{tracked.name}</span>
              <button onClick={() => { setTracked(null); setTelemetry(null); }} className="text-white/40 hover:text-white text-xs">✕</button>
            </div>
            {telemetry ? (
              <div className="mt-2 space-y-0.5 text-xs font-mono text-white/65">
                <div>lat {telemetry.lat.toFixed(2)}°  lng {telemetry.lng.toFixed(2)}°</div>
                <div>alt {telemetry.altKm.toFixed(0)} km</div>
                <div>vel {telemetry.speedKmS.toFixed(2)} km/s</div>
              </div>
            ) : <div className="mt-2 text-xs text-white/40">propagating…</div>}
            <Link href={`/satellites/${tracked.slug}`} className="inline-block mt-2 text-[11px] tracking-[0.15em] uppercase text-[var(--color-space-accent-2)]/80 hover:text-[var(--color-space-accent-2)]">Details →</Link>
          </div>
        )}

        {/* panel toggle */}
        <button onClick={() => setShowPanel((s) => !s)} className="absolute top-3 left-3 text-[10px] tracking-[0.2em] uppercase text-white/50 hover:text-white bg-black/50 border border-white/15 px-2.5 py-1.5">
          {showPanel ? "Hide stats" : "Stats"}
        </button>

        {/* time machine */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 border border-white/15 px-4 py-2">
          <button onClick={() => setOffsetMin(0)} className={`text-[10px] tracking-[0.2em] uppercase px-2.5 py-1 border transition-colors ${offsetMin === 0 ? "border-emerald-400/60 text-emerald-400" : "border-white/20 text-white/60 hover:text-white"}`}>
            {offsetMin === 0 ? "● Live" : "Live"}
          </button>
          <input type="range" min={-360} max={360} step={1} value={offsetMin} onChange={(e) => setOffsetMin(Number(e.target.value))} className="w-40 sm:w-56 accent-[var(--color-space-accent-2)] cursor-pointer" aria-label="Time machine" />
          <span className="font-mono text-xs text-white/75 tabular-nums w-44 text-center hidden sm:block">
            {shownTime.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" })}
          </span>
        </div>
      </div>
    </div>
  );
}
