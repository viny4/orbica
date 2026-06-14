"use client";

import { useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { EARTH_R, EARTH_ROTATION_Y } from "./geo";

// Textured, slowly-rotating Earth. Textures live in /public/textures.
export function Earth({ spin = true }: { spin?: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const [day, normal, specular] = useLoader(THREE.TextureLoader, [
    "/textures/earth_day.jpg",
    "/textures/earth_normal.jpg",
    "/textures/earth_specular.jpg",
  ]);

  useFrame((_, delta) => {
    if (spin && ref.current) ref.current.rotation.y += delta * 0.02;
  });

  return (
    <group rotation={[0, EARTH_ROTATION_Y, 0]}>
      <mesh ref={ref}>
        <sphereGeometry args={[EARTH_R, 64, 64]} />
        <meshPhongMaterial
          map={day}
          normalMap={normal}
          specularMap={specular}
          specular={new THREE.Color("#223355")}
          shininess={12}
        />
      </mesh>
      {/* Thin atmosphere halo */}
      <mesh scale={1.015}>
        <sphereGeometry args={[EARTH_R, 48, 48]} />
        <meshBasicMaterial color="#4a82ff" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}
