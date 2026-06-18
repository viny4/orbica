"use client";

import * as THREE from "three";

export default function ProceduralSatelliteModel() {
  return (
    <group>
      {/* Satellite Main Body - Metallic Silver Cylinder */}
      <mesh>
        <cylinderGeometry args={[0.015, 0.015, 0.05, 8]} />
        <meshStandardMaterial color="#e5e7eb" metalness={0.95} roughness={0.05} />
      </mesh>
      
      {/* Golden Instrument Block */}
      <mesh position={[0, -0.012, 0]}>
        <cylinderGeometry args={[0.016, 0.016, 0.015, 8]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Communications Antenna Cone */}
      <mesh position={[0, 0.03, 0]}>
        <coneGeometry args={[0.008, 0.016, 8]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Left Solar Array */}
      <group position={[-0.055, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.07, 0.002, 0.02]} />
          <meshStandardMaterial color="#1e40af" emissive="#0f172a" roughness={0.25} metalness={0.6} />
        </mesh>
        {/* Support Rod */}
        <mesh position={[0.04, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0015, 0.0015, 0.01, 4]} />
          <meshStandardMaterial color="#6b7280" />
        </mesh>
      </group>

      {/* Right Solar Array */}
      <group position={[0.055, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.07, 0.002, 0.02]} />
          <meshStandardMaterial color="#1e40af" emissive="#0f172a" roughness={0.25} metalness={0.6} />
        </mesh>
        {/* Support Rod */}
        <mesh position={[-0.04, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0015, 0.0015, 0.01, 4]} />
          <meshStandardMaterial color="#6b7280" />
        </mesh>
      </group>
    </group>
  );
}
