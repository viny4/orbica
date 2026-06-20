"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Html, Line } from "@react-three/drei";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Earth } from "@/components/three/Earth";
import { latLngAltToVec3, orbitPath, groundTrack, propagateTLE, type GeoPos } from "@/components/three/geo";
import { useInView } from "@/components/three/useInView";
import { Footprint } from "@/components/three/Footprint";
import ISSHub from "./ISSHub";
import ISSModel from "@/components/three/ISSModel";
import ProceduralSatelliteModel from "@/components/three/ProceduralSatelliteModel";
import { CountryLabels } from "@/components/three/CountryLabels";

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

function getBearing(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLon = (lng2 - lng1) * (Math.PI / 180);
  const l1 = lat1 * (Math.PI / 180);
  const l2 = lat2 * (Math.PI / 180);
  const y = Math.sin(dLon) * Math.cos(l2);
  const x = Math.cos(l1) * Math.sin(l2) - Math.sin(l1) * Math.cos(l2) * Math.cos(dLon);
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

function getDirection(bearing: number) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"];
  return dirs[Math.round(bearing / 45)];
}

function getElevation(userLat: number, userLng: number, satLat: number, satLng: number, satAlt: number) {
  const userVec = new THREE.Vector3(...latLngAltToVec3(userLat, userLng, 0));
  const satVec = new THREE.Vector3(...latLngAltToVec3(satLat, satLng, satAlt));
  const up = userVec.clone().normalize();
  const rel = satVec.clone().sub(userVec);
  rel.normalize();
  const cosTheta = up.dot(rel);
  return (Math.acos(cosTheta) * -180 / Math.PI) + 90;
}

function useConjunctions() {
  const [data, setData] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/v1/intel/conjunctions").then(r => r.ok ? r.json() : []).then(d => { if(Array.isArray(d)) setData(d); }).catch(() => {});
  }, []);
  return data;
}

function SkyCamera({ userCoords, active }: { userCoords: {lat: number, lng: number} | null, active: boolean }) {
  const { camera, gl } = useThree();
  const rotRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!active || !userCoords) {
      camera.up.set(0, 1, 0);
      return;
    }
    const v = latLngAltToVec3(userCoords.lat, userCoords.lng, 0.005);
    const up = new THREE.Vector3(...v).normalize();
    camera.position.set(v[0], v[1], v[2]);
    camera.up.copy(up);
    
    let isDragging = false;
    let prevX = 0; let prevY = 0;
    const onDown = (e: PointerEvent) => { isDragging = true; prevX = e.clientX; prevY = e.clientY; };
    const onUp = () => { isDragging = false; };
    const onMove = (e: PointerEvent) => {
      if (!isDragging) return;
      rotRef.current.x -= (e.clientX - prevX) * 0.005;
      rotRef.current.y += (e.clientY - prevY) * 0.005;
      rotRef.current.y = Math.max(-Math.PI/2, Math.min(Math.PI/2, rotRef.current.y));
      prevX = e.clientX; prevY = e.clientY;
    };
    
    const dom = gl.domElement;
    dom.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointermove", onMove);
    
    return () => {
      dom.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointermove", onMove);
    };
  }, [active, userCoords, camera, gl]);

  useFrame(() => {
    if (!active || !userCoords) return;
    const v = latLngAltToVec3(userCoords.lat, userCoords.lng, 0.005);
    const up = new THREE.Vector3(...v).normalize();
    camera.position.set(v[0], v[1], v[2]);
    camera.up.copy(up);

    const look = new THREE.Vector3(...v).normalize();
    const right = new THREE.Vector3().crossVectors(up, new THREE.Vector3(0,1,0)).normalize();
    if (right.lengthSq() < 0.01) right.set(1,0,0);
    const trueUp = new THREE.Vector3().crossVectors(right, look).normalize();
    
    look.applyAxisAngle(trueUp, rotRef.current.x);
    const rightAfterYaw = new THREE.Vector3().crossVectors(up, look).normalize();
    look.applyAxisAngle(rightAfterYaw, rotRef.current.y);

    camera.lookAt(v[0] + look.x, v[1] + look.y, v[2] + look.z);
  });

  return null;
}



// Ride-along: lock the camera just outside the tracked satellite, looking back
// at Earth, so the planet rotates beneath you as the satellite orbits. Re-derives
// the position every frame from the TLE (respecting the time-machine offset).
function RideAlongCamera({ line1, line2, offsetMin, active }: {
  line1: string; line2: string; offsetMin: number; active: boolean;
}) {
  const { camera } = useThree();
  useFrame(() => {
    if (!active) return;
    const p = propagateTLE(line1, line2, new Date(Date.now() + offsetMin * 60000));
    if (!p) return;
    const sat = new THREE.Vector3(...latLngAltToVec3(p.lat, p.lng, p.altKm));
    // Sit a little above the spacecraft (away from Earth) and look at the planet.
    const outward = sat.clone().normalize();
    camera.up.set(0, 1, 0);
    camera.position.copy(sat).add(outward.multiplyScalar(0.45));
    camera.lookAt(0, 0, 0);
  });
  return null;
}

// ── live stream ──────────────────────────────────────────────────────────────
function useTrackerStream() {
  const [positions, setPositions] = useState<LivePos[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "down">("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const offsetRef = useRef(0);
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
    const url = apiUrl ? apiUrl.replace(/^http/, "ws") : "";
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

function UserLocationMarker({ lat, lng }: { lat: number; lng: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => latLngAltToVec3(lat, lng, 0), [lat, lng]);

  useFrame(({ clock }) => {
    if (ref.current) {
      const scale = 1.0 + Math.sin(clock.getElapsedTime() * 5) * 0.15;
      ref.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group position={pos}>
      <mesh>
        <sphereGeometry args={[0.012, 16, 16]} />
        <meshBasicMaterial color="#10b981" />
      </mesh>
      <mesh ref={ref}>
        <ringGeometry args={[0.02, 0.04, 32]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      <Html distanceFactor={5} center>
        <div className="text-[8px] font-mono tracking-widest text-emerald-400 bg-black/80 px-1.5 py-0.5 border border-emerald-500/20 pointer-events-none uppercase whitespace-nowrap select-none">
          You
        </div>
      </Html>
    </group>
  );
}

// ── cloud ────────────────────────────────────────────────────────────────────
function SatelliteCloud({ positions, meta, mode, filter, dim, showMesh, onPick }: {
  positions: LivePos[]; meta: Map<number, Meta>; mode: ColorMode; filter: string | null; dim: boolean; showMesh: boolean;
  onPick: (p: LivePos) => void;
}) {
  const ref = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const shown = useMemo(
    () => (filter ? positions.filter((p) => categoryOf(mode, p, meta.get(p.norad_id)) === filter) : positions),
    [positions, filter, mode, meta],
  );
  const shownRef = useRef(shown);
  shownRef.current = shown;

  const [posAttr, colAttr] = useMemo(() => {
    const posArr = new Float32Array(shown.length * 3);
    const colArr = new Float32Array(shown.length * 3);
    const colorObj = new THREE.Color();

    shown.forEach((p, i) => {
      const [x, y, z] = latLngAltToVec3(p.lat, p.lng, p.altitude_km);
      posArr[i * 3] = x;
      posArr[i * 3 + 1] = y;
      posArr[i * 3 + 2] = z;

      const cStr = colorFor(mode, p, meta.get(p.norad_id));
      colorObj.set(cStr);
      if (dim) {
        colorObj.multiplyScalar(0.05); // Barely visible background glow when tracking a specific satellite
      } else {
        colorObj.multiplyScalar(0.45); // Softened default brightness to reduce clutter
      }
      colArr[i * 3] = colorObj.r;
      colArr[i * 3 + 1] = colorObj.g;
      colArr[i * 3 + 2] = colorObj.b;
    });

    return [posArr, colArr];
  }, [shown, mode, meta, dim]);

  useEffect(() => {
    const points = ref.current;
    if (!points) return;

    const geom = points.geometry;
    geom.setAttribute("position", new THREE.BufferAttribute(posAttr, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(colAttr, 3));
    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;
    geom.computeBoundingSphere();
  }, [posAttr, colAttr]);

  const [linePosAttr, setLinePosAttr] = useState<Float32Array | null>(null);
  useEffect(() => {
    if (!showMesh || !posAttr) {
      setLinePosAttr(null);
      return;
    }
    const slIdx: number[] = [];
    shown.forEach((p, i) => {
      if (meta.get(p.norad_id)?.constellation === "Starlink") slIdx.push(i);
    });

    const lines: number[] = [];
    for (let i=0; i<slIdx.length; i++) {
      const idxA = slIdx[i] * 3;
      const xA = posAttr[idxA], yA = posAttr[idxA+1], zA = posAttr[idxA+2];
      for (let j=i+1; j<slIdx.length; j++) {
        const idxB = slIdx[j] * 3;
        const xB = posAttr[idxB], yB = posAttr[idxB+1], zB = posAttr[idxB+2];
        const dx = xA - xB, dy = yA - yB, dz = zA - zB;
        if (dx*dx + dy*dy + dz*dz < 0.05) lines.push(xA, yA, zA, xB, yB, zB);
      }
    }
    setLinePosAttr(new Float32Array(lines));
  }, [posAttr, showMesh, shown, meta]);

  useEffect(() => {
    if (linesRef.current && linePosAttr) {
      linesRef.current.geometry.setAttribute("position", new THREE.BufferAttribute(linePosAttr, 3));
      linesRef.current.geometry.computeBoundingSphere();
    }
  }, [linePosAttr]);

  const sprite = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, "rgba(255, 255, 255, 1)");
      grad.addColorStop(0.3, "rgba(255, 255, 255, 0.7)");
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 16, 16);
    }
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, []);

  return (
    <>
    <points
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        const id = e.index;
        if (id != null && shownRef.current[id]) onPick(shownRef.current[id]);
      }}
    >
      <bufferGeometry />
      <pointsMaterial
        size={0.022}
        map={sprite}
        transparent
        depthWrite={false}
        vertexColors
        blending={THREE.AdditiveBlending}
        sizeAttenuation={true}
      />
    </points>
    {showMesh && linePosAttr && (
      <lineSegments ref={linesRef}>
        <bufferGeometry />
        <lineBasicMaterial color="#7df9ff" transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
    )}
    </>
  );
}

// Orbit path + glowing marker for the tracked satellite, propagated client-side.
function TrackedSatellite({ norad, line1, line2, offsetMin, userCoords, onTelemetry, onNextPass, viewMode }: {
  norad: number; line1: string; line2: string; offsetMin: number; userCoords: {lat: number, lng: number} | null; onTelemetry: (p: GeoPos) => void; onNextPass?: (np: {time: Date, maxEl: number}|null) => void; viewMode: "orbit" | "sky" | "ride";
}) {
  const marker = useRef<THREE.Object3D>(null);
  const glow = useRef<THREE.Mesh>(null);
  const acc = useRef(99);
  const orbit = useMemo(() => orbitPath(line1, line2, 240), [line1, line2]);
  // Ground track: where the satellite passes over the surface for the next ~95 min.
  const ground = useMemo(() => groundTrack(line1, line2, 95, 220), [line1, line2]);

  const [issPos, setIssPos] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (norad !== 25544) return;

    const fetchISS = () => {
      fetch("https://api.open-notify.org/iss-now.json")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.message === "success" && data.iss_position) {
            const lat = parseFloat(data.iss_position.latitude);
            const lng = parseFloat(data.iss_position.longitude);
            if (!isNaN(lat) && !isNaN(lng)) {
              setIssPos({ lat, lng });
            }
          }
        })
        .catch(() => {});
    };

    fetchISS();
    const timer = setInterval(fetchISS, 3000);
    return () => clearInterval(timer);
  }, [norad]);

  const [nextPass, setNextPass] = useState<{ time: Date, maxEl: number } | null>(null);
  useEffect(() => {
    if (!userCoords || norad === 25544) { setNextPass(null); return; }
    
    let maxEl = 0;
    const now = Date.now();
    let inPass = false;
    let passStart = -1;
    
    for(let i=0; i<1440; i++) {
      const t = now + i * 120000;
      const p = propagateTLE(line1, line2, new Date(t));
      if (!p) continue;
      
      const el = getElevation(userCoords.lat, userCoords.lng, p.lat, p.lng, p.altKm);
      if (el > 10) {
        if (!inPass) { inPass = true; passStart = t; }
        if (el > maxEl) maxEl = el;
      } else {
        if (inPass) {
          if (passStart > now) {
             setNextPass({ time: new Date(passStart), maxEl });
             return;
          }
          inPass = false;
          maxEl = 0;
        }
      }
    }
    setNextPass(null);
  }, [userCoords, line1, line2, norad]);

  useEffect(() => {
    if (onNextPass) onNextPass(nextPass);
  }, [nextPass, onNextPass]);

  useFrame((_, delta) => {
    acc.current += delta;
    if (acc.current < 0.25) return;
    acc.current = 0;

    let p: GeoPos | null = null;
    if (norad === 25544 && issPos) {
      p = {
        lat: issPos.lat,
        lng: issPos.lng,
        altKm: 420.0,
        speedKmS: 7.66,
      };
    } else {
      p = propagateTLE(line1, line2, new Date(Date.now() + offsetMin * 60000));
    }

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
      {/* ground track on the surface (hidden in sky view) */}
      {viewMode !== "sky" && ground.length > 1 && (
        <Line points={ground} color="#34d399" lineWidth={1.5} transparent opacity={0.7} dashed dashScale={50} />
      )}
      <mesh ref={glow}><sphereGeometry args={[viewMode === "sky" ? 0.005 : 0.07, 16, 16]} /><meshBasicMaterial color="#7df9ff" transparent opacity={0.3} /></mesh>
      <group ref={marker as any}>
        {viewMode !== "sky" && (norad === 25544 ? <ISSModel /> : <ProceduralSatelliteModel />)}
      </group>
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
  const [nextPass, setNextPass] = useState<{time: Date, maxEl: number} | null>(null);
  const [query, setQuery] = useState("");
  const [showPanel, setShowPanel] = useState(true);
  const [showMesh, setShowMesh] = useState(false);
  const [viewMode, setViewMode] = useState<"orbit" | "sky" | "ride">("orbit");
  const conjunctions = useConjunctions();
  // Ride-along has no target once the satellite is untracked — fall back to orbit.
  useEffect(() => {
    if (viewMode === "ride" && !tracked) setViewMode("orbit");
  }, [viewMode, tracked]);

  const [offsetMin, setOffsetMin] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setClock(Date.now()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { setOffset(offsetMin * 60); }, [offsetMin, setOffset]);
  const shownTime = useMemo(() => new Date(clock + offsetMin * 60000), [clock, offsetMin]);
  const sun = useMemo(() => sunDirection(shownTime), [shownTime]);

  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocationName, setUserLocationName] = useState<string | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [nearbySats, setNearbySats] = useState<{ norad_id: number; name: string; distance: number; lat: number; lng: number; alt: number, bearing: number, direction: string }[]>([]);

  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      setLocError("GPS not supported");
      return;
    }
    setLocLoading(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserCoords({ lat, lng });
        setLocLoading(false);
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
          .then(res => res.json())
          .then(data => {
            if (data && data.address) {
              const name = data.address.village || data.address.town || data.address.city || data.address.county || data.display_name.split(',')[0];
              const state = data.address.state || data.address.country;
              setUserLocationName(`${name}, ${state}`);
            }
          })
          .catch(() => {});
      },
      (err) => {
        setLocError("Location access denied");
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    if (!userCoords || !positions.length) return;
    const userR = 6371;
    const userPhi = (90 - userCoords.lat) * (Math.PI / 180);
    const userTheta = (userCoords.lng + 180) * (Math.PI / 180);
    const userX = -(userR * Math.sin(userPhi) * Math.cos(userTheta));
    const userY = userR * Math.cos(userPhi);
    const userZ = userR * Math.sin(userPhi) * Math.sin(userTheta);

    const calculated = positions.map((p) => {
      const satR = 6371 + p.altitude_km;
      const satPhi = (90 - p.lat) * (Math.PI / 180);
      const satTheta = (p.lng + 180) * (Math.PI / 180);
      const satX = -(satR * Math.sin(satPhi) * Math.cos(satTheta));
      const satY = satR * Math.cos(satPhi);
      const satZ = satR * Math.sin(satPhi) * Math.sin(satTheta);

      const dx = satX - userX;
      const dy = satY - userY;
      const dz = satZ - userZ;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const bearing = getBearing(userCoords.lat, userCoords.lng, p.lat, p.lng);

      return {
        norad_id: p.norad_id,
        name: p.name,
        distance: dist,
        lat: p.lat,
        lng: p.lng,
        alt: p.altitude_km,
        bearing,
        direction: getDirection(bearing),
      };
    });

    calculated.sort((a, b) => a.distance - b.distance);
    setNearbySats(calculated.slice(0, 8));
  }, [userCoords, positions]);

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
        setNextPass(null);
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
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      
      {conjunctions.length > 0 && (
        <div className="fixed top-16 left-0 w-full overflow-hidden bg-red-500/20 text-red-200 text-[10px] font-mono tracking-widest border-b border-red-500/30 py-1.5 z-20 backdrop-blur pointer-events-none">
          <div className="animate-[ticker_60s_linear_infinite] whitespace-nowrap">
            {conjunctions.concat(conjunctions).map((c, i) => (
              <span key={i} className="mx-8">
                <span className="font-bold text-red-400">WARNING: </span>
                {c.sat_a_name} ↔ {c.sat_b_name} · MISS: {c.miss_km.toFixed(2)}km · REL SPEED: {c.rel_speed_kms.toFixed(1)}km/s
              </span>
            ))}
          </div>
        </div>
      )}

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
          <div>
            <div className="text-[10px] tracking-[0.25em] uppercase text-white/40 mb-2 flex justify-between">
              <span>Constellation Mesh</span>
              <button onClick={() => setShowMesh(!showMesh)} className={`px-2 py-0.5 border ${showMesh ? 'border-[var(--color-space-accent-2)] text-[var(--color-space-accent-2)]' : 'border-white/20 text-white/50'}`}>
                {showMesh ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* Geolocation Card */}
          <div className="border border-white/10 bg-white/[0.015] p-4">
            <div className="text-[10px] tracking-[0.25em] uppercase text-white/40 mb-2.5 flex justify-between items-center">
              <span>My Location</span>
              {userCoords && <span className="text-emerald-400 font-mono text-[9px] uppercase">Active</span>}
            </div>
            
            {!userCoords ? (
              <div className="space-y-2">
                <p className="text-[11px] text-white/45 font-light leading-relaxed">
                  Enable location access to show satellites passing near your coordinates in real time.
                </p>
                <button
                  onClick={handleShareLocation}
                  disabled={locLoading}
                  className="w-full text-center text-[10px] font-mono uppercase tracking-widest py-2 bg-white/[0.04] border border-white/10 hover:bg-white/10 hover:border-white/30 text-white transition-colors"
                >
                  {locLoading ? "Accessing GPS..." : "Share My Location"}
                </button>
                {locError && <p className="text-[10px] text-red-400 font-mono">{locError}</p>}
              </div>
            ) : (
              <div className="space-y-4 font-mono text-[10px] text-white/60">

                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span>GPS COORDS:</span>
                  <div className="text-right">
                    <div className="text-white">{userCoords.lat.toFixed(3)}°N, {userCoords.lng.toFixed(3)}°E</div>
                    {userLocationName && <div className="text-[9px] text-emerald-400/80 mt-1">{userLocationName}</div>}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-[9px] tracking-wider text-white/30 uppercase">Closest Overhead</div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {nearbySats.map((sat) => (
                      <button
                        key={sat.norad_id}
                        onClick={() => track(sat.norad_id)}
                        className="w-full text-left bg-white/[0.01] hover:bg-white/[0.04] border border-white/5 p-2 flex justify-between items-center transition-colors group"
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="truncate text-white/70 group-hover:text-[var(--color-space-accent-2)] transition-colors">{sat.name}</span>
                          <span className="text-[9px] text-white/40 font-mono mt-0.5">{sat.direction} ({Math.round(sat.bearing)}°)</span>
                        </div>
                        <span className="text-emerald-400 shrink-0 font-semibold">{Math.round(sat.distance).toLocaleString()} km</span>
                      </button>
                    ))}
                    {nearbySats.length === 0 && (
                      <div className="text-[10px] text-white/30 italic">No satellites in range</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* globe — first on mobile (the main view), sidebar drops below it */}
      <div ref={ref} className="order-1 lg:order-2 relative h-[70vh] lg:h-[82vh] overflow-hidden border border-white/10 bg-black">
        {armed && (
          <Canvas
            camera={{ position: [0, 2, 7], fov: 45 }}
            dpr={[1, 2]}
            frameloop={inView ? "always" : "never"}
            raycaster={{ params: { Points: { threshold: 0.08 } } } as any}
          >
            <ambientLight intensity={0.16} />
            <directionalLight position={sun} intensity={2} />
            <Suspense fallback={<Html center>Loading globe…</Html>}>
              <Stars radius={90} depth={50} count={4000} factor={4} fade />
              {viewMode !== "sky" && <Earth spin={false} />}
              {viewMode !== "sky" && <CountryLabels />}
              {userCoords && <UserLocationMarker lat={userCoords.lat} lng={userCoords.lng} />}
              <SatelliteCloud positions={positions} meta={meta} mode={mode} filter={filter} dim={Boolean(tracked)} showMesh={showMesh} onPick={(p) => track(p.norad_id)} />
              {tracked && <TrackedSatellite norad={tracked.norad} line1={tracked.line1} line2={tracked.line2} offsetMin={offsetMin} userCoords={userCoords} onTelemetry={setTelemetry} onNextPass={setNextPass} viewMode={viewMode} />}
              {tracked && telemetry && (
                <Footprint
                  lat={telemetry.lat}
                  lng={telemetry.lng}
                  altKm={telemetry.altKm}
                  color="#7df9ff"
                />
              )}
              <SkyCamera userCoords={userCoords} active={viewMode === "sky"} />
              {tracked && (
                <RideAlongCamera line1={tracked.line1} line2={tracked.line2} offsetMin={offsetMin} active={viewMode === "ride"} />
              )}
            </Suspense>
            <OrbitControls enablePan={false} minDistance={3.2} maxDistance={20} autoRotate={!tracked && viewMode === "orbit"} autoRotateSpeed={0.18} enabled={viewMode === "orbit"} />
          </Canvas>
        )}

        {/* Floating view toggles — Sky View (needs your location) + Ride Along (needs a tracked satellite) */}
        <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
          {userCoords && (
            <button
              onClick={() => setViewMode(v => v === "sky" ? "orbit" : "sky")}
              className={`flex items-center gap-2 px-5 py-2.5 border rounded-full text-[11px] font-mono uppercase tracking-widest transition-all shadow-xl backdrop-blur-md ${viewMode === "sky" ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-emerald-500/20" : "bg-black/50 border-white/20 text-white/70 hover:bg-white/10 hover:text-white hover:border-white/50"}`}
            >
              {viewMode === "sky" ? "Exit Sky View" : "🔭 Enter Sky View"}
            </button>
          )}
          {tracked && (
            <button
              onClick={() => setViewMode(v => v === "ride" ? "orbit" : "ride")}
              className={`flex items-center gap-2 px-5 py-2.5 border rounded-full text-[11px] font-mono uppercase tracking-widest transition-all shadow-xl backdrop-blur-md ${viewMode === "ride" ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-cyan-500/20" : "bg-black/50 border-white/20 text-white/70 hover:bg-white/10 hover:text-white hover:border-white/50"}`}
            >
              {viewMode === "ride" ? "Exit Ride Along" : "🛰 Ride Along"}
            </button>
          )}
        </div>

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
          tracked.norad === 25544 ? (
            <ISSHub
              velocity={telemetry?.speedKmS ?? 7.66}
              altitude={telemetry?.altKm ?? 418.5}
              onClose={() => { setTracked(null); setTelemetry(null); }}
            />
          ) : (
            <div className="absolute bottom-16 left-3 bg-black/70 backdrop-blur border border-[var(--color-space-accent-2)]/40 p-4 w-64">
              <div className="flex items-start justify-between gap-3">
                <span className="text-[var(--color-space-accent-2)] font-semibold text-sm">{tracked.name}</span>
                <button onClick={() => { setTracked(null); setTelemetry(null); setNextPass(null); }} className="text-white/40 hover:text-white text-xs">✕</button>
              </div>
              {telemetry ? (
                <div className="mt-2 space-y-0.5 text-xs font-mono text-white/65">
                  <div>lat {telemetry.lat.toFixed(2)}°  lng {telemetry.lng.toFixed(2)}°</div>
                  <div>alt {telemetry.altKm.toFixed(0)} km</div>
                  <div>vel {telemetry.speedKmS.toFixed(2)} km/s</div>
                </div>
              ) : <div className="mt-2 text-xs text-white/40">propagating…</div>}
              {nextPass && (
                <div className="mt-3 p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                  <div className="uppercase tracking-widest text-emerald-400/60 mb-0.5">Next Flyover</div>
                  <div>{nextPass.time.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })} (Max El: {Math.round(nextPass.maxEl)}°)</div>
                </div>
              )}
              <Link href={`/satellites/${tracked.slug}`} className="inline-block mt-2 text-[11px] tracking-[0.15em] uppercase text-[var(--color-space-accent-2)]/80 hover:text-[var(--color-space-accent-2)]">Details →</Link>
            </div>
          )
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
