"use client";

import * as THREE from "three";

// Distinct procedural spacecraft by class, so a Starlink, a GPS bird, Hubble and
// a Dragon don't all render as the same generic box. Derived from the
// satellite's purpose / constellation / name.
type Kind = "starlink" | "comsat" | "nav" | "eo" | "telescope" | "capsule" | "cubesat";

function deriveKind(purpose?: string | null, constellation?: string | null, name?: string | null): Kind {
  const n = (name || "").toUpperCase();
  const p = (purpose || "").toLowerCase();
  if (constellation === "Starlink" || n.startsWith("STARLINK")) return "starlink";
  if (/HUBBLE|KEPLER|TESS|SPITZER|CHANDRA|WEBB|JWST|XMM|GAIA/.test(n) || p.includes("telescope") || p.includes("astrophysics"))
    return "telescope";
  if (p.includes("human") || /DRAGON|SOYUZ|SHENZHOU|CYGNUS|PROGRESS|CREW|STARLINER|ORION/.test(n)) return "capsule";
  if (p.includes("navigation") || /GPS|GALILEO|GLONASS|BEIDOU|NAVSTAR|QZSS|IRNSS/.test(n)) return "nav";
  if (p.includes("earth observation") || p.includes("weather") || p.includes("imaging") || p.includes("radar") || p.includes("reconnaissance"))
    return "eo";
  if (p.includes("technology") || /CUBESAT|LEMUR|SPIRE|FLOCK|DOVE|SWARM/.test(n)) return "cubesat";
  return "comsat";
}

const PANEL = "#1b2f6b";
const PANEL_EMIT = "#0a1530";
const FOIL = "#caa64a"; // MLI gold foil
const METAL = "#d4d8de";

function Panel({ x, w, h = 0.024, color = PANEL }: { x: number; w: number; h?: number; color?: string }) {
  return (
    <mesh position={[x, 0, 0]}>
      <boxGeometry args={[w, 0.0018, h]} />
      <meshStandardMaterial color={color} emissive={PANEL_EMIT} emissiveIntensity={0.45} roughness={0.32} metalness={0.55} />
    </mesh>
  );
}

function Wings({ span = 0.075, h = 0.024 }: { span?: number; h?: number }) {
  return (
    <>
      <Panel x={-span} w={span * 1.6} h={h} />
      <Panel x={span} w={span * 1.6} h={h} />
    </>
  );
}

export default function ProceduralSatelliteModel({
  purpose,
  constellation,
  name,
}: {
  purpose?: string | null;
  constellation?: string | null;
  name?: string | null;
}) {
  const kind = deriveKind(purpose, constellation, name);

  switch (kind) {
    case "starlink":
      // Flat slab chassis with a single long solar array — Starlink's signature.
      return (
        <group rotation={[0, 0, 0.15]}>
          <mesh>
            <boxGeometry args={[0.05, 0.006, 0.032]} />
            <meshStandardMaterial color="#2b2f36" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0.085, 0.004, 0]}>
            <boxGeometry args={[0.11, 0.0018, 0.034]} />
            <meshStandardMaterial color={PANEL} emissive={PANEL_EMIT} emissiveIntensity={0.5} roughness={0.3} metalness={0.55} />
          </mesh>
        </group>
      );

    case "telescope":
      // Long foil-wrapped tube (Hubble-like) with an open aperture and small wings.
      return (
        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.02, 0.02, 0.09, 16]} />
            <meshStandardMaterial color={FOIL} metalness={0.85} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.047, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.004, 16]} />
            <meshStandardMaterial color="#0b0d11" metalness={0.2} roughness={0.8} />
          </mesh>
          <group rotation={[-Math.PI / 2, 0, 0]}>
            <Panel x={-0.05} w={0.06} h={0.03} />
            <Panel x={0.05} w={0.06} h={0.03} />
          </group>
        </group>
      );

    case "capsule":
      // Gumdrop capsule + a trunk with body-mounted arrays (Dragon-like).
      return (
        <group>
          <mesh position={[0, 0.012, 0]}>
            <coneGeometry args={[0.022, 0.03, 20]} />
            <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.45} />
          </mesh>
          <mesh position={[0, -0.012, 0]}>
            <cylinderGeometry args={[0.024, 0.024, 0.03, 20]} />
            <meshStandardMaterial color="#3a3f47" metalness={0.4} roughness={0.5} />
          </mesh>
          {/* curved body array hugging the trunk */}
          <mesh position={[0, -0.012, 0.025]}>
            <boxGeometry args={[0.05, 0.028, 0.002]} />
            <meshStandardMaterial color={PANEL} emissive={PANEL_EMIT} emissiveIntensity={0.4} roughness={0.3} metalness={0.5} />
          </mesh>
        </group>
      );

    case "nav":
      // Compact boxy bus, dual symmetric wings, a downward nav-payload panel.
      return (
        <group>
          <mesh>
            <boxGeometry args={[0.03, 0.03, 0.03]} />
            <meshStandardMaterial color={FOIL} metalness={0.8} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.02, 0]}>
            <boxGeometry args={[0.026, 0.008, 0.026]} />
            <meshStandardMaterial color="#1b1d22" metalness={0.3} roughness={0.7} />
          </mesh>
          <Wings span={0.07} />
        </group>
      );

    case "eo":
      // Earth-observation bus with a downward-pointing sensor/telescope barrel.
      return (
        <group>
          <mesh>
            <boxGeometry args={[0.028, 0.04, 0.028]} />
            <meshStandardMaterial color={FOIL} metalness={0.8} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.032, 0]}>
            <cylinderGeometry args={[0.012, 0.016, 0.025, 16]} />
            <meshStandardMaterial color="#15171c" metalness={0.4} roughness={0.6} />
          </mesh>
          <Wings span={0.066} />
        </group>
      );

    case "cubesat":
      // Tiny cube with body-mounted cells.
      return (
        <group>
          <mesh>
            <boxGeometry args={[0.02, 0.02, 0.03] } />
            <meshStandardMaterial color={PANEL} emissive={PANEL_EMIT} emissiveIntensity={0.35} metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.014, 0]}>
            <boxGeometry args={[0.006, 0.01, 0.006]} />
            <meshStandardMaterial color={METAL} metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      );

    default: // comsat — boxy GEO bus, big wings, a comms dish on top
      return (
        <group>
          <mesh>
            <boxGeometry args={[0.03, 0.034, 0.03]} />
            <meshStandardMaterial color={FOIL} metalness={0.82} roughness={0.38} />
          </mesh>
          <mesh position={[0, 0.028, 0.006]} rotation={[0.5, 0, 0]}>
            <sphereGeometry args={[0.013, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={METAL} metalness={0.6} roughness={0.35} side={THREE.DoubleSide} />
          </mesh>
          <Wings span={0.085} h={0.03} />
        </group>
      );
  }
}
