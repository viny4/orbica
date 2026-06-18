"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { Suspense, useMemo } from "react";
import { useInView } from "@/components/three/useInView";
import ISSModel from "@/components/three/ISSModel";

export interface SatModelSpec {
  purpose?: string | null;
  orbitType?: string | null;
  name?: string | null;
}

// Palette + body feature derived from the spacecraft's purpose.
function profile(purpose?: string | null) {
  const p = (purpose || "").toLowerCase();
  if (p.includes("comm")) return { body: "#c8a23a", feature: "dish" as const };
  if (p.includes("navigation")) return { body: "#cdd3df", feature: "antenna" as const };
  if (p.includes("weather")) return { body: "#e7ecf5", feature: "sensor" as const };
  if (p.includes("earth")) return { body: "#3a4a63", feature: "sensor" as const };
  if (p.includes("telescope") || p.includes("science")) return { body: "#9aa7bd", feature: "telescope" as const };
  if (p.includes("human")) return { body: "#d7dbe2", feature: "module" as const };
  if (p.includes("planetary")) return { body: "#b8962f", feature: "dish" as const };
  return { body: "#aab4c8", feature: "antenna" as const };
}

function Satellite({ purpose }: { purpose?: string | null }) {
  const { body, feature } = useMemo(() => profile(purpose), [purpose]);

  return (
    <group rotation={[0.3, 0.6, 0]}>
      {/* Central bus — MLI-foil look */}
      <mesh castShadow>
        <boxGeometry args={[1, 1.1, 1.3]} />
        <meshStandardMaterial color={body} metalness={0.6} roughness={0.35} />
      </mesh>

      {/* Solar array wings (both sides, on booms) */}
      {[-1, 1].map((dir) => (
        <group key={dir}>
          <mesh position={[dir * 0.85, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.04, 0.04, 0.7, 8]} />
            <meshStandardMaterial color="#444" metalness={0.5} />
          </mesh>
          <mesh position={[dir * 2.1, 0, 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[2.4, 0.04, 0.95]} />
            <meshStandardMaterial color="#15305e" metalness={0.35} roughness={0.5} emissive="#0a1a38" emissiveIntensity={0.4} />
          </mesh>
          {/* cell seams */}
          <mesh position={[dir * 2.1, 0.026, 0]}>
            <boxGeometry args={[2.4, 0.005, 0.95]} />
            <meshStandardMaterial color="#2a4a86" wireframe />
          </mesh>
        </group>
      ))}

      {/* Purpose-specific feature */}
      {feature === "dish" && (
        <group position={[0, 0.2, 0.95]} rotation={[-0.5, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.62, 0.18, 0.18, 32, 1, true]} />
            <meshStandardMaterial color="#e8ecf4" metalness={0.4} roughness={0.4} side={2} />
          </mesh>
          <mesh position={[0, 0.28, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
            <meshStandardMaterial color="#888" />
          </mesh>
        </group>
      )}
      {feature === "telescope" && (
        <mesh position={[0, 1.05, 0]}>
          <cylinderGeometry args={[0.45, 0.45, 1.2, 32, 1, true]} />
          <meshStandardMaterial color="#23262e" metalness={0.7} roughness={0.3} side={2} />
        </mesh>
      )}
      {feature === "sensor" && (
        <mesh position={[0, -0.85, 0]}>
          <cylinderGeometry args={[0.22, 0.32, 0.5, 24]} />
          <meshStandardMaterial color="#15171c" metalness={0.6} roughness={0.4} />
        </mesh>
      )}
      {feature === "module" && (
        <mesh position={[0, 0, 0.95]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.45, 0.45, 0.8, 24]} />
          <meshStandardMaterial color="#cfd4dc" metalness={0.5} roughness={0.4} />
        </mesh>
      )}
      {(feature === "antenna" || feature === "module") && (
        <group position={[0, 0.7, 0]}>
          <mesh>
            <cylinderGeometry args={[0.015, 0.015, 0.7, 8]} />
            <meshStandardMaterial color="#999" />
          </mesh>
          <mesh position={[0, 0.4, 0]}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshStandardMaterial color="#7df9ff" emissive="#1e6b73" />
          </mesh>
        </group>
      )}
    </group>
  );
}

export default function SatelliteModel3D({ spec }: { spec: SatModelSpec }) {
  const { ref, inView, armed } = useInView<HTMLDivElement>();
  const isISS = (spec.name || "").toLowerCase().includes("iss") || (spec.name || "").toLowerCase().includes("zarya");

  return (
    <div
      ref={ref}
      className="relative w-full aspect-square overflow-hidden border border-white/10 bg-gradient-to-b from-[#0a1020] to-[#04060d]"
    >
      {armed ? (
        <Canvas camera={{ position: [3.5, 1.8, 4] }} dpr={[1, 2]} frameloop={inView ? "always" : "never"}>
          <color attach="background" args={["#05070f"]} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[6, 8, 5]} intensity={1.5} />
          <directionalLight position={[-5, -2, -4]} intensity={0.4} color="#7df9ff" />
          <Suspense fallback={<Html center>Loading…</Html>}>
            {isISS ? (
              <group scale={[22, 22, 22]}>
                <ISSModel />
              </group>
            ) : (
              <Satellite purpose={spec.purpose} />
            )}
          </Suspense>
          <OrbitControls enablePan={false} minDistance={3} maxDistance={12} autoRotate autoRotateSpeed={0.8} />
        </Canvas>
      ) : (
        <div className="absolute inset-0 grid place-items-center text-white/30 text-xs tracking-[0.2em] uppercase">
          3D model
        </div>
      )}
      <div className="absolute top-3 right-3 text-[10px] text-white/35 font-mono">
        model · drag to rotate
      </div>
    </div>
  );
}
