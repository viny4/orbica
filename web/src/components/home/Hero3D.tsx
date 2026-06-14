"use client";

import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { Suspense } from "react";
import { Earth } from "@/components/three/Earth";
import { useInView } from "@/components/three/useInView";

// Ambient, cinematic rotating Earth used as the landing hero backdrop.
// Render loop pauses once the hero scrolls out of view.
export default function Hero3D() {
  const { ref, inView } = useInView<HTMLDivElement>("0px");
  return (
    <div ref={ref} style={{ position: "absolute", inset: 0 }}>
    <Canvas
      camera={{ position: [0, 0.6, 5.2], fov: 38 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      frameloop={inView ? "always" : "never"}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={["#04060d"]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 2, 4]} intensity={2.2} color="#fff6e8" />
      <directionalLight position={[-6, -1, -4]} intensity={0.5} color="#2a4a8a" />
      <Suspense fallback={null}>
        <Stars radius={120} depth={60} count={5000} factor={4} saturation={0} fade speed={0.4} />
        <group position={[1.1, -0.4, 0]} scale={1.35}>
          <Earth spin />
        </group>
      </Suspense>
    </Canvas>
    </div>
  );
}
