"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Earth } from "@/components/three/Earth";
import { EARTH_R } from "@/components/three/geo";
import { placementFor } from "./heroGeometry";
import { FpsTicker } from "@/components/three/FpsTicker";

const CAMERA_Z = 5.2;
const FOV = 38;
const TARGET_FPS = 30;

// Puts the globe where heroGeometry says, in world units, for the current
// canvas aspect — the same spot the CSS poster occupies.
function Placement({ children }: { children: React.ReactNode }) {
  const size = useThree((s) => s.size);
  const aspect = size.width / Math.max(1, size.height);
  const p = placementFor(aspect);
  const halfH = CAMERA_Z * Math.tan(((FOV / 2) * Math.PI) / 180);
  const x = (p.cx - 0.5) * 2 * halfH * aspect;
  const y = (0.5 - p.cy) * 2 * halfH;
  const scale = (p.r * 2 * halfH) / EARTH_R;
  return (
    <group position={[x, y, 0]} scale={scale}>
      {children}
    </group>
  );
}

// Inclined orbits with a satellite riding each — the orbital geometry is part
// of the scene (lit, depth-tested against the planet), not a flat overlay.
const ORBITS = [
  { radius: 1.32, tilt: [1.2, 0, 0.35], speed: 0.16, color: "#7df9ff", opacity: 0.32 },
  { radius: 1.58, tilt: [1.45, 0, -0.5], speed: -0.1, color: "#5b8cff", opacity: 0.22 },
  { radius: 1.95, tilt: [1.05, 0, 0.9], speed: 0.06, color: "#9fb4ff", opacity: 0.14 },
] as const;

function Orbits({ animate }: { animate: boolean }) {
  const sats = useRef<(THREE.Mesh | null)[]>([]);
  const lines = useMemo(
    () =>
      ORBITS.map((o) => {
        const curve = new THREE.EllipseCurve(0, 0, o.radius * EARTH_R, o.radius * EARTH_R, 0, Math.PI * 2);
        const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(160));
        const mat = new THREE.LineBasicMaterial({ color: o.color, transparent: true, opacity: o.opacity, depthWrite: false });
        return new THREE.LineLoop(geo, mat);
      }),
    [],
  );
  useEffect(
    () => () =>
      lines.forEach((l) => {
        l.geometry.dispose();
        (l.material as THREE.Material).dispose();
      }),
    [lines],
  );

  useFrame(({ clock }) => {
    if (!animate) return;
    const t = clock.getElapsedTime();
    ORBITS.forEach((o, i) => {
      const m = sats.current[i];
      if (!m) return;
      const a = t * o.speed + i * 2.1;
      m.position.set(Math.cos(a) * o.radius * EARTH_R, Math.sin(a) * o.radius * EARTH_R, 0);
    });
  });

  return (
    <>
      {ORBITS.map((o, i) => (
        <group key={i} rotation={[...o.tilt] as [number, number, number]}>
          <primitive object={lines[i]} />
          <mesh
            ref={(m) => {
              sats.current[i] = m;
            }}
            position={[o.radius * EARTH_R, 0, 0]}
          >
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshBasicMaterial color={o.color} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function FirstFrame({ onReady }: { onReady?: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (!done.current) {
      done.current = true;
      // Next frame: the texture-mapped globe is actually on screen.
      requestAnimationFrame(() => onReady?.());
    }
  });
  return null;
}

export default function Hero3D({ inView = true, reducedMotion = false, onReady }: { inView?: boolean; reducedMotion?: boolean; onReady?: () => void }) {
  const animate = inView && !reducedMotion;
  return (
    <Canvas
      camera={{ position: [0, 0, CAMERA_Z], fov: FOV }}
      // 1.5x is indistinguishable from 2x on a soft, glowing planet and renders
      // ~45% fewer pixels on retina screens.
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      frameloop="demand"
      style={{ position: "absolute", inset: 0 }}
    >
      {/* ~30fps while visible; one still frame when hidden, scrolled away or
          reduced-motion. */}
      <FpsTicker active={animate} fps={TARGET_FPS} />
      <ambientLight intensity={0.32} />
      <directionalLight position={[6, 2, 4]} intensity={2.2} color="#fff6e8" />
      <directionalLight position={[-6, -1, -4]} intensity={0.5} color="#2a4a8a" />
      <Suspense fallback={null}>
        <Stars radius={120} depth={60} count={2600} factor={4} saturation={0} fade speed={animate ? 0.4 : 0} />
        <Placement>
          <Earth spin={animate} />
          <Orbits animate={animate} />
        </Placement>
        <FirstFrame onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
