"use client";

import { useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { EARTH_R, EARTH_ROTATION_Y } from "./geo";

// Textured, slowly-rotating Earth. Textures live in /public/textures.
const AtmosphereShader = {
  vertexShader: `
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    void main() {
      float intensity = pow(0.7 - dot(vNormal, vec3(0, 0, 1.0)), 2.5);
      gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
    }
  `
};

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
      
      {/* High-tech tactical grid wireframe */}
      <mesh scale={1.002}>
        <sphereGeometry args={[EARTH_R, 36, 36]} />
        <meshBasicMaterial color="#4f75ff" wireframe transparent opacity={0.06} />
      </mesh>

      {/* Upgraded atmosphere glow */}
      <mesh scale={1.12}>
        <sphereGeometry args={[EARTH_R, 48, 48]} />
        <shaderMaterial
          vertexShader={AtmosphereShader.vertexShader}
          fragmentShader={AtmosphereShader.fragmentShader}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          transparent
        />
      </mesh>
    </group>
  );
}
