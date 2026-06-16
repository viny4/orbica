"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { useMemo, useState, Suspense } from "react";
import * as THREE from "three";
import { deriveConfig, type RocketSpec, type RocketConfig } from "./rocketConfig";
import { useInView } from "@/components/three/useInView";

export type { RocketSpec };

// A tangent-ogive payload-fairing silhouette (revolved as a lathe): a short
// cylindrical base, then a smooth convex curve to a softly-rounded tip — what a
// real fairing looks like, not the sharpened-pencil cone we had before.
function ogiveProfile(r: number, h: number): THREE.Vector2[] {
  const steps = 32;
  const cyl = 0.22; // straight cylindrical fraction at the base
  const L = h * (1 - cyl); // length of the curved ogive section
  const rho = (r * r + L * L) / (2 * r); // ogive radius (tangent at the base)
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const yy = f * h;
    let x: number;
    if (f <= cyl) {
      x = r;
    } else {
      // t = distance up from the base of the ogive (0 → radius r, L → tip ~0).
      const t = ((f - cyl) / (1 - cyl)) * L;
      x = Math.sqrt(Math.max(0, rho * rho - t * t)) - (rho - r);
    }
    pts.push(new THREE.Vector2(Math.max(0.012, x), yy));
  }
  return pts;
}

// A blunt rounded capsule/escape-tower silhouette for crewed vehicles.
function capsuleProfile(r: number, h: number): THREE.Vector2[] {
  const steps = 24;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    // Quarter-ellipse: wide blunt base curving to a rounded dome.
    const x = r * 0.92 * Math.cos((f * Math.PI) / 2 * 0.88);
    pts.push(new THREE.Vector2(Math.max(0.02, x), f * h));
  }
  return pts;
}

// A nose cone or payload fairing, shaped by type.
function Nose({ cfg, y }: { cfg: RocketConfig; y: number }) {
  const r = cfg.diameter / 2;
  const capsule = cfg.fairing === "capsule";
  const h = cfg.height * (capsule ? 0.12 : 0.17);
  const profile = useMemo(
    () => (capsule ? capsuleProfile(r, h) : ogiveProfile(r, h)),
    [capsule, r, h],
  );
  return (
    <group position={[0, y, 0]}>
      <mesh castShadow>
        <latheGeometry args={[profile, 56]} />
        <meshStandardMaterial color={cfg.palette.upper} metalness={0.2} roughness={0.5} />
      </mesh>
      {/* crewed: slender launch-escape-tower spike on top of the capsule */}
      {capsule && (
        <mesh position={[0, h * 1.02 + cfg.height * 0.04, 0]}>
          <coneGeometry args={[r * 0.05, cfg.height * 0.08, 16]} />
          <meshStandardMaterial color="#2a2f3a" metalness={0.5} roughness={0.5} />
        </mesh>
      )}
    </group>
  );
}

function Engines({ count, radius, color }: { count: number; radius: number; color: string }) {
  const nozzles = useMemo(() => {
    if (count <= 1) return [[0, 0]] as [number, number][];
    const out: [number, number][] = [[0, 0]];
    const ring = count - 1;
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * Math.PI * 2;
      out.push([Math.cos(a) * radius * 0.6, Math.sin(a) * radius * 0.6]);
    }
    return out.slice(0, count);
  }, [count, radius]);
  const nr = Math.max(0.12, (radius * 0.9) / Math.sqrt(count));
  return (
    <group>
      {nozzles.map(([x, z], i) => (
        <mesh key={i} position={[x, -0.4, z]}>
          <coneGeometry args={[nr, nr * 1.6, 16, 1, true]} />
          <meshStandardMaterial color={color} metalness={0.7} roughness={0.5} side={2} />
        </mesh>
      ))}
    </group>
  );
}

// One strap-on/SRB hugging the core at angle `a`.
function Booster({ cfg, a, highlight }: { cfg: RocketConfig; a: number; highlight: boolean }) {
  const r = cfg.diameter / 2;
  const isStrap = cfg.boosterKind === "strapon";
  const isCore = cfg.boosterKind === "core";
  const bh = isCore ? cfg.height * 0.7 : cfg.height * (isStrap ? 0.45 : 0.55);
  const br = isCore ? r * 0.85 : r * (isStrap ? 0.42 : 0.34);
  const dist = r + br * 0.92;
  const color = highlight ? "#7df9ff" : isStrap ? cfg.palette.booster : cfg.palette.booster;
  return (
    <group position={[Math.cos(a) * dist, bh / 2, Math.sin(a) * dist]}>
      <mesh>
        <cylinderGeometry args={[br, br, bh, 28]} />
        <meshStandardMaterial color={color} metalness={0.25} roughness={0.52} emissive={highlight ? "#1e6b73" : "#000"} />
      </mesh>
      {/* tapered/pointed booster nose */}
      <mesh position={[0, bh / 2 + bh * (isStrap ? 0.16 : 0.1), 0]}>
        <coneGeometry args={[br, bh * (isStrap ? 0.32 : 0.2), 24]} />
        <meshStandardMaterial color={color} metalness={0.25} roughness={0.52} />
      </mesh>
      {isCore && <Engines count={9} radius={br} color="#23262e" />}
    </group>
  );
}

function Rocket({ cfg, highlightStage }: { cfg: RocketConfig; highlightStage: number | null }) {
  const r = cfg.diameter / 2;
  const scale = 11 / cfg.height;
  const bodyH = cfg.height * 0.82;
  const each = bodyH / cfg.stages;

  const stages = useMemo(
    () =>
      Array.from({ length: cfg.stages }, (_, i) => ({
        idx: i,
        r: r * (1 - i * 0.1),
        y: each * i + each / 2,
        h: each * 0.98,
        color: i === 0 ? cfg.palette.body : cfg.palette.upper,
      })),
    [cfg, r, each],
  );

  const boosterAngles = useMemo(
    () => Array.from({ length: cfg.boosters }, (_, i) => (i / cfg.boosters) * Math.PI * 2),
    [cfg.boosters],
  );

  return (
    <group scale={scale} position={[0, -5.5, 0]}>
      {/* core stages */}
      {stages.map((s) => {
        const active = highlightStage === s.idx;
        return (
          <mesh key={s.idx} position={[0, s.y, 0]} castShadow>
            <cylinderGeometry args={[s.r, s.r * 1.02, s.h, 48]} />
            <meshStandardMaterial
              color={active ? "#7df9ff" : s.color}
              metalness={0.22}
              roughness={0.55}
              emissive={active ? "#1e6b73" : "#000"}
            />
          </mesh>
        );
      })}

      {/* interstage ring accents */}
      {stages.slice(1).map((s) => (
        <mesh key={`r${s.idx}`} position={[0, s.y - s.h / 2, 0]}>
          <cylinderGeometry args={[s.r * 1.04, s.r * 1.04, cfg.height * 0.012, 48]} />
          <meshStandardMaterial color={cfg.palette.accent} metalness={0.5} roughness={0.5} />
        </mesh>
      ))}

      <Nose cfg={cfg} y={bodyH} />
      <Engines count={cfg.engines} radius={r} color="#23262e" />

      {boosterAngles.map((a, i) => (
        <Booster key={i} cfg={cfg} a={a} highlight={false} />
      ))}
    </group>
  );
}

export default function RocketViewer3D({ spec }: { spec: RocketSpec }) {
  const cfg = useMemo(() => deriveConfig(spec), [spec]);
  const [highlightStage, setHighlightStage] = useState<number | null>(null);
  const { ref, inView, armed } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className="relative w-full aspect-square overflow-hidden border border-white/10 bg-gradient-to-b from-[#0a1020] to-[#04060d]"
    >
      {/* WebGL only initialises once scrolled into view, and the render loop
          stops whenever the viewer is off-screen — no GPU work in the background. */}
      {armed ? (
        <Canvas
          shadows
          camera={{ position: [9, 4, 13], fov: 42 }}
          dpr={[1, 2]}
          frameloop={inView ? "always" : "never"}
        >
          <color attach="background" args={["#05070f"]} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[10, 16, 10]} intensity={1.7} color="#fff8f0" castShadow />
          <directionalLight position={[-8, 4, -6]} intensity={0.4} color="#c2cad6" />
          <Suspense fallback={<Html center>Loading…</Html>}>
            <Rocket cfg={cfg} highlightStage={highlightStage} />
          </Suspense>
          <OrbitControls enablePan={false} minDistance={7} maxDistance={32} autoRotate autoRotateSpeed={0.6} />
          <gridHelper args={[50, 50, "#16203a", "#0b1020"]} position={[0, -5.5, 0]} />
        </Canvas>
      ) : (
        <div className="absolute inset-0 grid place-items-center text-white/30 text-xs tracking-[0.2em] uppercase">
          3D model
        </div>
      )}

      <div className="absolute bottom-3 left-3 flex gap-2">
        {Array.from({ length: cfg.stages }, (_, i) => (
          <button
            key={i}
            onMouseEnter={() => setHighlightStage(i)}
            onMouseLeave={() => setHighlightStage(null)}
            className={`text-[10px] tracking-[0.15em] uppercase px-2.5 py-1 border transition-colors ${
              highlightStage === i
                ? "border-[var(--color-space-accent-2)] text-[var(--color-space-accent-2)]"
                : "border-white/15 text-white/50 hover:text-white"
            }`}
          >
            Stage {i + 1}
          </button>
        ))}
      </div>
      <div className="absolute top-3 right-3 text-[10px] text-white/35 font-mono">
        {cfg.boosters > 0 ? `${cfg.boosters} boosters · ` : ""}
        {cfg.engines} engine{cfg.engines > 1 ? "s" : ""} · drag to rotate
      </div>
    </div>
  );
}
