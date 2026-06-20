"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Html, Line } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Earth } from "./Earth";
import { latLngAltToVec3, orbitPath, propagateTLE, type GeoPos, type Vec3 } from "./geo";
import { useInView } from "./useInView";
import Link from "next/link";
import ProceduralSatelliteModel from "./ProceduralSatelliteModel";
import { CountryLabels } from "./CountryLabels";
import { Footprint } from "./Footprint";

interface LivePos {
  norad_id: number;
  name: string;
  lat: number;
  lng: number;
  altitude_km: number;
  velocity_km_s: number;
}

interface SatelliteMeta {
  id: string;
  name: string;
  norad_id: number | null;
  orbit_type: string | null;
  status: string | null;
}

interface ConstellationGlobeProps {
  satellites: SatelliteMeta[];
  constellationName: string;
}

// ── WebSocket Subscriber ───────────────────────────────────────────────────
function useConstellationStream(noradIds: Set<number>) {
  const [positions, setPositions] = useState<Map<number, LivePos>>(new Map());
  const [status, setStatus] = useState<"connecting" | "live" | "down">("connecting");
  const wsRef = useRef<WebSocket | null>(null);

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
      };

      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data) as LivePos[];
          if (Array.isArray(d)) {
            const updated = new Map<number, LivePos>();
            d.forEach((p) => {
              if (noradIds.has(p.norad_id)) {
                updated.set(p.norad_id, p);
              }
            });
            if (updated.size > 0) {
              setPositions((prev) => {
                const next = new Map(prev);
                updated.forEach((v, k) => next.set(k, v));
                return next;
              });
            }
          }
        } catch { /* ignore */ }
      };

      ws.onclose = () => {
        setStatus("down");
        retry = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      clearTimeout(retry);
      ws?.close();
    };
  }, [noradIds]);

  return { positions: Array.from(positions.values()), status };
}

// ── Orbit Path & glowing marker for tracked satellite ───────────────────────
function TrackedSatellite({ norad, line1, line2, onTelemetry }: {
  norad: number; line1: string; line2: string; onTelemetry: (p: GeoPos) => void;
}) {
  const marker = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  const acc = useRef(99);
  const orbit = useMemo(() => orbitPath(line1, line2, 240), [line1, line2]);

  useFrame((_, delta) => {
    acc.current += delta;
    if (acc.current < 0.25) return;
    acc.current = 0;

    const p = propagateTLE(line1, line2, new Date());
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
      <mesh ref={glow}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshBasicMaterial color="#7df9ff" transparent opacity={0.3} />
      </mesh>
      <group ref={marker}>
        <ProceduralSatelliteModel />
      </group>
    </>
  );
}

// ── Satellite Cloud & Laser Mesh ───────────────────────────────────────────
function ConstellationMesh({ positions, onPick }: { positions: LivePos[]; onPick: (norad: number) => void }) {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);

  // Compute 3D positions in scene coordinates
  const cartesianPositions = useMemo(() => {
    return positions.map((p) => {
      const vec = latLngAltToVec3(p.lat, p.lng, p.altitude_km);
      return {
        norad_id: p.norad_id,
        pos: vec,
      };
    });
  }, [positions]);

  const shownRef = useRef(cartesianPositions);
  shownRef.current = cartesianPositions;

  // Update Points Geometry
  useEffect(() => {
    const points = pointsRef.current;
    if (!points) return;

    const posArr = new Float32Array(cartesianPositions.length * 3);
    cartesianPositions.forEach((cp, i) => {
      posArr[i * 3] = cp.pos[0];
      posArr[i * 3 + 1] = cp.pos[1];
      posArr[i * 3 + 2] = cp.pos[2];
    });

    points.geometry.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
    points.geometry.attributes.position.needsUpdate = true;
    points.geometry.computeBoundingSphere();
  }, [cartesianPositions]);

  // Update Laser Mesh Cross-Links & Nadir Lines
  const [lineSegmentsPos, setLineSegmentsPos] = useState<Float32Array>(new Float32Array(0));
  useEffect(() => {
    const segments: number[] = [];
    const threshold = 0.48; // Max distance in Three.js units to draw a cross-link laser

    // 1. Procedural Laser Cross-Links (connecting neighboring satellites)
    for (let i = 0; i < cartesianPositions.length; i++) {
      const cp1 = cartesianPositions[i];
      let linksCount = 0;
      for (let j = i + 1; j < cartesianPositions.length; j++) {
        if (linksCount >= 2) break;
        const cp2 = cartesianPositions[j];
        const dx = cp1.pos[0] - cp2.pos[0];
        const dy = cp1.pos[1] - cp2.pos[1];
        const dz = cp1.pos[2] - cp2.pos[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < threshold) {
          segments.push(...cp1.pos);
          segments.push(...cp2.pos);
          linksCount++;
        }
      }
    }

    // 2. Nadir Lines (beams from satellites to Earth surface)
    const nadirCount = Math.min(120, cartesianPositions.length);
    for (let i = 0; i < nadirCount; i++) {
      const cp = cartesianPositions[i];
      const p = positions[i];
      const groundPos = latLngAltToVec3(p.lat, p.lng, 0);
      segments.push(...cp.pos);
      segments.push(...groundPos);
    }

    setLineSegmentsPos(new Float32Array(segments));
  }, [cartesianPositions, positions]);

  // Update Line Segments Geometry
  useEffect(() => {
    const lines = linesRef.current;
    if (!lines) return;

    lines.geometry.setAttribute("position", new THREE.BufferAttribute(lineSegmentsPos, 3));
    lines.geometry.attributes.position.needsUpdate = true;
    lines.geometry.computeBoundingSphere();
  }, [lineSegmentsPos]);

  // Create particle texture
  const sprite = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, "rgba(255, 255, 255, 1)");
      grad.addColorStop(0.3, "rgba(125, 249, 255, 0.8)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 16, 16);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  return (
    <group>
      {/* Satellites Points */}
      <points
        ref={pointsRef}
        onClick={(e) => {
          e.stopPropagation();
          const idx = e.index;
          if (idx != null && shownRef.current[idx]) {
            onPick(shownRef.current[idx].norad_id);
          }
        }}
      >
        <bufferGeometry />
        <pointsMaterial
          size={0.045}
          map={sprite}
          transparent
          depthWrite={false}
          color="#7df9ff"
          blending={THREE.AdditiveBlending}
          sizeAttenuation={true}
        />
      </points>

      {/* Laser Connections & Nadir lines */}
      <lineSegments ref={linesRef}>
        <bufferGeometry />
        <lineBasicMaterial
          color="#7df9ff"
          transparent
          opacity={0.16}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
    </group>
  );
}

// ── Main Globe Component ──────────────────────────────────────────────────
export default function ConstellationGlobe({ satellites, constellationName }: ConstellationGlobeProps) {
  const { ref, inView, armed } = useInView<HTMLDivElement>("0px");

  // Create a lookup set of active NORAD IDs
  const noradIds = useMemo(() => {
    return new Set(satellites.map((s) => s.norad_id).filter(Boolean) as number[]);
  }, [satellites]);

  // Satellite Metadata Map
  const metaMap = useMemo(() => {
    const m = new Map<number, SatelliteMeta>();
    satellites.forEach((s) => {
      if (s.norad_id) m.set(s.norad_id, s);
    });
    return m;
  }, [satellites]);

  const { positions, status } = useConstellationStream(noradIds);

  // Tracking Selected Satellite
  const [tracked, setTracked] = useState<SatelliteMeta | null>(null);
  const [tle, setTle] = useState<{ line1: string; line2: string } | null>(null);
  const [telemetry, setTelemetry] = useState<GeoPos | null>(null);

  const handlePickSatellite = async (norad: number) => {
    const sat = metaMap.get(norad);
    if (!sat) return;

    setTracked(sat);
    setTelemetry(null);
    setTle(null);

    try {
      const res = await fetch(`/api/v1/satellites/${sat.id}/tle`);
      if (!res.ok) return;
      const t = await res.json();
      if (t?.tle_line1 && t?.tle_line2) {
        setTle({ line1: t.tle_line1, line2: t.tle_line2 });
      }
    } catch { /* ignore */ }
  };

  return (
    <div
      ref={ref}
      className="relative w-full h-[50vh] md:h-full overflow-hidden border border-white/10 bg-black"
    >
      {armed && (
        <Canvas
          camera={{ position: [0, 2.2, 5.2], fov: 45 }}
          dpr={[1, 2]}
          frameloop={inView ? "always" : "never"}
          raycaster={{ params: { Points: { threshold: 0.08 } } } as any}
        >
          <ambientLight intensity={0.18} />
          <directionalLight position={[10, 10, 10]} intensity={1.8} />
          <Suspense fallback={<Html center>Loading globe…</Html>}>
            <Stars radius={90} depth={50} count={2500} factor={4} fade />
            <Earth spin={!tracked} />
            <CountryLabels />
            <ConstellationMesh positions={positions} onPick={handlePickSatellite} />
            
            {tle && tracked && (
              <TrackedSatellite
                norad={tracked.norad_id || 0}
                line1={tle.line1}
                line2={tle.line2}
                onTelemetry={setTelemetry}
              />
            )}

            {tle && tracked && telemetry && (
              <Footprint
                lat={telemetry.lat}
                lng={telemetry.lng}
                altKm={telemetry.altKm}
                color="#7df9ff"
              />
            )}
          </Suspense>
          <OrbitControls enablePan={false} minDistance={3.2} maxDistance={12} autoRotate={positions.length === 0} autoRotateSpeed={0.2} />
        </Canvas>
      )}

      {/* Selected Satellite Telemetry Panel */}
      {tracked && (
        <div className="absolute bottom-12 left-3 bg-black/75 backdrop-blur border border-[var(--color-space-accent-2)]/45 p-4 w-60 z-10 text-xs font-mono">
          <div className="flex items-start justify-between gap-3">
            <span className="text-[var(--color-space-accent-2)] font-semibold font-sans">{tracked.name}</span>
            <button onClick={() => { setTracked(null); setTle(null); setTelemetry(null); }} className="text-white/40 hover:text-white text-[10px]">✕</button>
          </div>
          <div className="mt-2 space-y-0.5 text-white/60 text-[10px]">
            <div>NORAD ID: {tracked.norad_id || "—"}</div>
            <div>STATUS: {tracked.status || "active"}</div>
            <div>ORBIT: {tracked.orbit_type || "—"}</div>
            {telemetry ? (
              <div className="mt-2 pt-2 border-t border-white/5 space-y-0.5 text-[var(--color-space-accent-2)]">
                <div>LAT: {telemetry.lat.toFixed(2)}°  LNG: {telemetry.lng.toFixed(2)}°</div>
                <div>ALT: {telemetry.altKm.toFixed(0)} km</div>
                <div>VEL: {telemetry.speedKmS.toFixed(2)} km/s</div>
              </div>
            ) : (
              <div className="mt-2 pt-2 border-t border-white/5 text-white/40">propagating…</div>
            )}
          </div>
          <Link href={`/satellites/${tracked.id}`} className="inline-block mt-3 text-[10px] tracking-[0.15em] uppercase text-[var(--color-space-accent-2)]/80 hover:underline">Details →</Link>
        </div>
      )}

      {/* Status Overlay */}
      <div className="absolute top-3 right-3 text-[10px] text-white/35 font-mono bg-black/55 backdrop-blur px-2.5 py-1.5 border border-white/5 flex items-center gap-2">
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${
            status === "live" ? "bg-emerald-400" : status === "connecting" ? "bg-amber-400" : "bg-red-400"
          }`}
        />
        <span className="uppercase tracking-wider">
          {status === "live" ? `${positions.length} Live tracked` : status}
        </span>
      </div>

      <div className="absolute bottom-3 left-3 text-[9px] text-white/30 font-mono">
        drag to rotate · scroll to zoom · click node to track
      </div>
    </div>
  );
}
