"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { latLngAltToVec3 } from "./geo";

const COUNTRIES = [
  { name: "United States", lat: 37.0902, lng: -95.7129 },
  { name: "Canada", lat: 56.1304, lng: -106.3468 },
  { name: "Brazil", lat: -14.2350, lng: -51.9253 },
  { name: "United Kingdom", lat: 55.3781, lng: -3.4360 },
  { name: "France", lat: 46.2276, lng: 2.2137 },
  { name: "Germany", lat: 51.1657, lng: 10.4515 },
  { name: "Russia", lat: 61.5240, lng: 105.3188 },
  { name: "India", lat: 20.5937, lng: 78.9629 },
  { name: "China", lat: 35.8617, lng: 104.1954 },
  { name: "Japan", lat: 36.2048, lng: 138.2529 },
  { name: "Australia", lat: -25.2744, lng: 133.7751 },
  { name: "South Africa", lat: -30.5595, lng: 22.9375 },
];

function CountryMarker({ name, lat, lng }: { name: string; lat: number; lng: number }) {
  const ref = useRef<THREE.Group>(null);
  // Earth radius is 2.0; project slightly above surface (e.g. 5km above surface)
  const pos = latLngAltToVec3(lat, lng, 10);
  const { camera } = useThree();

  useFrame(() => {
    if (!ref.current) return;
    const dist = camera.position.length();
    // Only show when zoomed in close (dist < 5.8)
    if (dist > 5.8) {
      ref.current.visible = false;
      return;
    }

    // Check if on facing hemisphere
    const pointVec = new THREE.Vector3(...pos).normalize();
    const camVec = new THREE.Vector3().copy(camera.position).normalize();
    const dot = pointVec.dot(camVec);

    ref.current.visible = dot > 0.25;
  });

  return (
    <group ref={ref} position={pos}>
      <mesh>
        <sphereGeometry args={[0.006, 8, 8]} />
        <meshBasicMaterial color="#7df9ff" transparent opacity={0.6} />
      </mesh>
      <Html distanceFactor={5.5} center>
        <div className="text-[8px] font-mono tracking-widest text-white/50 bg-black/75 px-1.5 py-0.5 border border-white/10 pointer-events-none uppercase whitespace-nowrap select-none">
          {name}
        </div>
      </Html>
    </group>
  );
}

export function CountryLabels() {
  return (
    <group>
      {COUNTRIES.map((c) => (
        <CountryMarker key={c.name} name={c.name} lat={c.lat} lng={c.lng} />
      ))}
    </group>
  );
}
