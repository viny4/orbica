"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { EARTH_R, EARTH_KM, latLngAltToVec3, type Vec3 } from "./geo";

interface Props {
  lat: number;
  lng: number;
  altKm: number;
  color?: string;
}

export function Footprint({ lat, lng, altKm, color = "#7df9ff" }: Props) {
  const diskRef = useRef<THREE.Mesh>(null);
  const coneRef = useRef<THREE.Mesh>(null);

  // Compute position vectors
  const { satVec, groundVec, midVec, dirVec, height, radius, quat } = useMemo(() => {
    // Satellite position in scene coordinates
    const sat = latLngAltToVec3(lat, lng, altKm);
    
    // Sub-satellite point on Earth's surface (offset slightly to prevent z-fighting)
    const ground = latLngAltToVec3(lat, lng, 12); // offset by 12km (very tiny in scene units)
    
    const vSat = new THREE.Vector3(...sat);
    const vGround = new THREE.Vector3(...ground);
    
    // Midpoint between sat and ground
    const vMid = new THREE.Vector3().addVectors(vSat, vGround).multiplyScalar(0.5);
    
    // Direction vector from ground to sat (pointing along the radial vector)
    const vDir = new THREE.Vector3().subVectors(vSat, vGround).normalize();
    
    // Compute cone height (distance from ground to satellite)
    const h = vSat.distanceTo(vGround);
    
    // Calculate physical coverage radius on flat tangent plane
    const r_e = EARTH_R;
    const r_sat = EARTH_R * (1 + altKm / EARTH_KM);
    const cosTheta = r_e / r_sat;
    const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
    const rad = r_e * sinTheta;
    
    // Quaternion to rotate Y-axis [0,1,0] to point along vDir
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vDir);
    
    return {
      satVec: sat,
      groundVec: ground,
      midVec: [vMid.x, vMid.y, vMid.z] as Vec3,
      dirVec: [vDir.x, vDir.y, vDir.z] as Vec3,
      height: h,
      radius: rad,
      quat: q,
    };
  }, [lat, lng, altKm]);

  // Circle vertices for the ground disk ring
  const circlePoints = useMemo(() => {
    const temp = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const pts: [number, number, number][] = [];
    const segments = 64;
    
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      // Define a circle in the XZ plane
      temp.set(Math.cos(theta) * radius, 0, Math.sin(theta) * radius);
      // Rotate the circle points to align with the sub-satellite normal vector
      temp.applyQuaternion(quat);
      // Translate to the ground position
      temp.add(new THREE.Vector3(...groundVec));
      pts.push([temp.x, temp.y, temp.z]);
    }
    return pts;
  }, [radius, groundVec, quat]);

  return (
    <group>
      {/* 1. Nadir Line (connecting satellite to ground) */}
      <Line
        points={[satVec, groundVec]}
        color={color}
        lineWidth={1.5}
        dashed
        dashScale={50}
        gapSize={1.5}
        transparent
        opacity={0.65}
      />

      {/* 2. Ground Coverage Disk Edge (circle on surface) */}
      {circlePoints.length > 1 && (
        <Line
          points={circlePoints}
          color={color}
          lineWidth={2}
          transparent
          opacity={0.8}
        />
      )}

      {/* 3. Transparent Coverage Cone */}
      <mesh
        ref={coneRef}
        position={midVec}
        quaternion={quat}
      >
        <coneGeometry args={[radius, height, 32, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
