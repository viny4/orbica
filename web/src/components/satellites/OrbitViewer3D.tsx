"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Html, Stars } from "@react-three/drei";
import { useMemo, useRef, useState, Suspense } from "react";
import * as THREE from "three";
import { Earth } from "@/components/three/Earth";
import { latLngAltToVec3, orbitPath, propagateTLE, type GeoPos } from "@/components/three/geo";
import { useInView } from "@/components/three/useInView";
import { Footprint } from "@/components/three/Footprint";

interface Props {
  name: string;
  line1: string;
  line2: string;
}

function SatelliteMarker({ line1, line2, onPos }: Props & { onPos: (p: GeoPos) => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const acc = useRef(99);

  // Re-propagate a few times a second via the R3F loop, so it naturally
  // pauses whenever the canvas render loop is stopped (off-screen / hidden).
  useFrame((_, delta) => {
    acc.current += delta;
    if (acc.current < 0.3) return;
    acc.current = 0;
    const p = propagateTLE(line1, line2, new Date());
    if (p && ref.current) {
      const [x, y, z] = latLngAltToVec3(p.lat, p.lng, p.altKm);
      ref.current.position.set(x, y, z);
      glow.current?.position.set(x, y, z);
      onPos(p);
    }
  });

  return (
    <>
      <mesh ref={ref}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshBasicMaterial color="#7df9ff" />
      </mesh>
      <mesh ref={glow}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshBasicMaterial color="#7df9ff" transparent opacity={0.25} />
      </mesh>
    </>
  );
}

function OrbitLine({ line1, line2 }: { line1: string; line2: string }) {
  const pts = useMemo(() => orbitPath(line1, line2, 200), [line1, line2]);
  if (pts.length < 2) return null;
  return <Line points={pts} color="#5b8cff" lineWidth={1.5} transparent opacity={0.7} />;
}

export default function OrbitViewer3D({ name, line1, line2 }: Props) {
  const [pos, setPos] = useState<GeoPos | null>(null);
  const { ref, inView, armed } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className="relative w-full aspect-square overflow-hidden border border-white/10 bg-black"
    >
      {armed ? (
        <Canvas camera={{ position: [0, 1.5, 6], fov: 45 }} dpr={[1, 2]} frameloop={inView ? "always" : "never"}>
          <ambientLight intensity={0.35} />
          <directionalLight position={[5, 3, 5]} intensity={1.6} />
          <Suspense fallback={<Html center>Loading globe…</Html>}>
            <Stars radius={80} depth={40} count={2000} factor={3} fade />
            <Earth spin={false} />
            <OrbitLine line1={line1} line2={line2} />
            <SatelliteMarker name={name} line1={line1} line2={line2} onPos={setPos} />
            {pos && (
              <Footprint
                lat={pos.lat}
                lng={pos.lng}
                altKm={pos.altKm}
                color="#7df9ff"
              />
            )}
          </Suspense>
          <OrbitControls enablePan={false} minDistance={3} maxDistance={14} autoRotate autoRotateSpeed={0.3} />
        </Canvas>
      ) : (
        <div className="absolute inset-0 grid place-items-center text-white/30 text-xs tracking-[0.2em] uppercase">
          Live orbit
        </div>
      )}

      <div className="absolute top-3 left-3 text-xs font-mono bg-black/50 rounded-lg px-3 py-2 border border-white/10">
        <div className="text-[var(--color-space-accent-2)] font-semibold mb-1">{name}</div>
        {pos ? (
          <div className="space-y-0.5 text-white/55">
            <div>lat {pos.lat.toFixed(2)}°  lng {pos.lng.toFixed(2)}°</div>
            <div>alt {pos.altKm.toFixed(0)} km</div>
            <div>vel {pos.speedKmS.toFixed(2)} km/s</div>
          </div>
        ) : (
          <div className="text-white/40">propagating…</div>
        )}
      </div>
      <div className="absolute bottom-3 right-3 text-[10px] text-white/35 font-mono">
        live SGP4 · drag to rotate
      </div>
    </div>
  );
}
