"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Distinct procedural spacecraft by class, so a Starlink, a GPS bird, Hubble and
// a Dragon don't all render as the same generic box. Derived from the
// satellite's purpose / constellation / name.
type Kind = "starlink" | "comsat" | "nav" | "eo" | "telescope" | "capsule" | "cubesat" | "science";

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
  if (p.includes("science") || p.includes("research") || p.includes("planetary")) return "science";
  return "comsat";
}

const PANEL = "#1b2f6b";
const PANEL_EMIT = "#0a1530";
const FOIL = "#caa64a"; // MLI gold foil
const FOIL_DARK = "#8a7030";
const METAL = "#d4d8de";
const METAL_DARK = "#8a919c";
const RADIATOR = "#e8ecf2";

// ── Reusable parts ───────────────────────────────────────────────────────────

// Solar panel with cell grid detail
function Panel({
  x = 0,
  y = 0,
  z = 0,
  w,
  h = 0.024,
  color = PANEL,
  rotation = [0, 0, 0] as [number, number, number],
}: {
  x?: number; y?: number; z?: number;
  w: number; h?: number; color?: string;
  rotation?: [number, number, number];
}) {
  const cols = Math.max(2, Math.round(w * 60));
  const rows = Math.max(2, Math.round(h * 60));
  return (
    <group position={[x, y, z]} rotation={rotation}>
      {/* Backing frame */}
      <mesh>
        <boxGeometry args={[w + 0.001, 0.0014, h + 0.001]} />
        <meshStandardMaterial color="#0d1424" roughness={0.85} metalness={0.3} />
      </mesh>
      {/* Cell surface */}
      <mesh position={[0, 0.0004, 0]}>
        <boxGeometry args={[w, 0.0006, h]} />
        <meshStandardMaterial
          color={color}
          emissive={PANEL_EMIT}
          emissiveIntensity={0.5}
          roughness={0.28}
          metalness={0.6}
        />
      </mesh>
      {/* Cell divider lines */}
      {Array.from({ length: rows - 1 }).map((_, i) => {
        const z = -h / 2 + ((i + 1) / rows) * h;
        return (
          <mesh key={`r${i}`} position={[0, 0.0008, z]}>
            <boxGeometry args={[w, 0.0002, 0.0004]} />
            <meshStandardMaterial color="#05080f" roughness={0.9} />
          </mesh>
        );
      })}
      {Array.from({ length: cols - 1 }).map((_, i) => {
        const cx = -w / 2 + ((i + 1) / cols) * w;
        return (
          <mesh key={`c${i}`} position={[cx, 0.0008, 0]}>
            <boxGeometry args={[0.0004, 0.0002, h]} />
            <meshStandardMaterial color="#05080f" roughness={0.9} />
          </mesh>
        );
      })}
      {/* Support boom connecting to bus */}
      <mesh position={[-Math.sign(x || 1) * (w / 2 + 0.008), -0.003, 0]}>
        <cylinderGeometry args={[0.0012, 0.0012, 0.02, 6]} />
        <meshStandardMaterial color={METAL_DARK} metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

// Symmetric wing pair
function Wings({ span = 0.075, h = 0.024, tilt = 0 }: { span?: number; h?: number; tilt?: number }) {
  return (
    <>
      <Panel x={-span} w={span * 1.6} h={h} rotation={[0, 0, tilt]} />
      <Panel x={span} w={span * 1.6} h={h} rotation={[0, 0, -tilt]} />
    </>
  );
}

// Parabolic dish antenna
function Dish({
  position = [0, 0, 0] as [number, number, number],
  rotation = [0, 0, 0] as [number, number, number],
  radius = 0.013,
  color = METAL,
}: {
  position?: [number, number, number];
  rotation?: [number, number, number];
  radius?: number;
  color?: string;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <sphereGeometry args={[radius, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} metalness={0.65} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* Feed horn */}
      <mesh position={[0, radius * 0.55, 0]}>
        <cylinderGeometry args={[radius * 0.12, radius * 0.12, radius * 0.5, 8]} />
        <meshStandardMaterial color="#2b2f36" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0, radius * 0.85, 0]}>
        <sphereGeometry args={[radius * 0.14, 8, 8]} />
        <meshStandardMaterial color="#1b1d22" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}

// Helical / whip antenna
function Antenna({
  position = [0, 0, 0] as [number, number, number],
  rotation = [0, 0, 0] as [number, number, number],
  length = 0.03,
  color = METAL,
}: {
  position?: [number, number, number];
  rotation?: [number, number, number];
  length?: number;
  color?: string;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, length / 2, 0]}>
        <cylinderGeometry args={[0.0006, 0.0004, length, 6]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, length + 0.0015, 0]}>
        <sphereGeometry args={[0.0016, 8, 8]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}

// Radiator panel (heat rejection)
function Radiator({
  position = [0, 0, 0] as [number, number, number],
  rotation = [0, 0, 0] as [number, number, number],
  w = 0.02,
  h = 0.012,
}: {
  position?: [number, number, number];
  rotation?: [number, number, number];
  w?: number;
  h?: number;
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={[w, 0.0006, h]} />
      <meshStandardMaterial color={RADIATOR} roughness={0.85} metalness={0.1} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Small thruster cluster
function Thrusters({ position = [0, 0, 0] as [number, number, number], scale = 1 }: {
  position?: [number, number, number]; scale?: number;
}) {
  return (
    <group position={position} scale={scale}>
      {[[0.004, 0.004], [-0.004, 0.004], [0.004, -0.004], [-0.004, -0.004]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0, z]}>
          <cylinderGeometry args={[0.0016, 0.0022, 0.003, 8]} />
          <meshStandardMaterial color="#3a3f47" metalness={0.75} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

// Star tracker / camera head
function StarTracker({ position = [0, 0, 0] as [number, number, number], rotation = [0, 0, 0] as [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <cylinderGeometry args={[0.003, 0.003, 0.006, 10]} />
        <meshStandardMaterial color="#2b2f36" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.0031, 0]}>
        <cylinderGeometry args={[0.0024, 0.0024, 0.0006, 10]} />
        <meshBasicMaterial color="#0b1220" />
      </mesh>
    </group>
  );
}

// ── Models ───────────────────────────────────────────────────────────────────

// Slowly counter-rotating solar arrays give parked/tracked satellites life.
function useSolarSpin(ref: React.RefObject<THREE.Group | null>, speed = 0.05) {
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * speed;
  });
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
  const arrayRef = useRef<THREE.Group>(null);
  useSolarSpin(arrayRef, kind === "comsat" ? 0.04 : 0.08);

  switch (kind) {
    case "starlink":
      // Flat slab chassis with a single long solar array — Starlink's signature.
      return (
        <group rotation={[0, 0, 0.15]}>
          {/* Body */}
          <mesh>
            <boxGeometry args={[0.05, 0.006, 0.032]} />
            <meshStandardMaterial color="#2b2f36" metalness={0.6} roughness={0.4} />
          </mesh>
          {/* Body solar cells */}
          <mesh position={[0, 0.0032, 0]}>
            <boxGeometry args={[0.048, 0.0004, 0.03]} />
            <meshStandardMaterial color={PANEL} emissive={PANEL_EMIT} emissiveIntensity={0.4} roughness={0.3} metalness={0.6} />
          </mesh>
          {/* Long solar array */}
          <group ref={arrayRef}>
            <mesh position={[0.085, 0.004, 0]}>
              <boxGeometry args={[0.11, 0.0018, 0.034]} />
              <meshStandardMaterial color={PANEL} emissive={PANEL_EMIT} emissiveIntensity={0.5} roughness={0.3} metalness={0.55} />
            </mesh>
            {/* Array cell lines */}
            {[-0.03, -0.01, 0.01, 0.03].map((x, i) => (
              <mesh key={i} position={[0.085 + x, 0.005, 0]}>
                <boxGeometry args={[0.0006, 0.0002, 0.034]} />
                <meshStandardMaterial color="#05080f" roughness={0.9} />
              </mesh>
            ))}
          </group>
          {/* Communications antennas */}
          <Antenna position={[-0.026, 0.004, 0.012]} rotation={[0.3, 0, 0.2]} length={0.022} />
          <Antenna position={[-0.026, 0.004, -0.012]} rotation={[-0.3, 0, 0.2]} length={0.022} />
        </group>
      );

    case "telescope":
      // Long foil-wrapped tube (Hubble-like) with an open aperture and small wings.
      return (
        <group rotation={[Math.PI / 2, 0, 0]}>
          {/* Main tube with MLI wrap bands */}
          <mesh>
            <cylinderGeometry args={[0.02, 0.02, 0.09, 24]} />
            <meshStandardMaterial color={FOIL} metalness={0.85} roughness={0.35} />
          </mesh>
          {[-0.03, -0.01, 0.01, 0.03].map((y, i) => (
            <mesh key={i} position={[0, y, 0]}>
              <cylinderGeometry args={[0.0203, 0.0203, 0.002, 24]} />
              <meshStandardMaterial color={FOIL_DARK} metalness={0.8} roughness={0.45} />
            </mesh>
          ))}
          {/* Aperture */}
          <mesh position={[0, 0.047, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.004, 24]} />
            <meshStandardMaterial color="#0b0d11" metalness={0.2} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.0475, 0]}>
            <cylinderGeometry args={[0.013, 0.013, 0.002, 20]} />
            <meshBasicMaterial color="#05070a" />
          </mesh>
          {/* Aft equipment bay */}
          <mesh position={[0, -0.05, 0]}>
            <cylinderGeometry args={[0.021, 0.021, 0.012, 20]} />
            <meshStandardMaterial color={METAL_DARK} metalness={0.7} roughness={0.4} />
          </mesh>
          {/* Solar wings (telescopes keep them perpendicular) */}
          <group rotation={[-Math.PI / 2, 0, 0]}>
            <Panel x={-0.05} w={0.06} h={0.03} />
            <Panel x={0.05} w={0.06} h={0.03} />
          </group>
          {/* High-gain antenna on the aft end */}
          <Dish position={[0, -0.058, 0.012]} rotation={[Math.PI, 0, 0]} radius={0.008} />
          <Antenna position={[0.014, -0.05, 0]} rotation={[0, 0, -0.4]} length={0.035} />
        </group>
      );

    case "capsule":
      // Gumdrop capsule + a trunk with body-mounted arrays (Dragon-like).
      return (
        <group>
          {/* Nose cone / forward hatch */}
          <mesh position={[0, 0.028, 0]}>
            <cylinderGeometry args={[0.003, 0.010, 0.008, 16]} />
            <meshStandardMaterial color="#6b7280" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Capsule body (gumdrop) */}
          <mesh position={[0, 0.012, 0]}>
            <coneGeometry args={[0.022, 0.03, 24]} />
            <meshStandardMaterial color={METAL} metalness={0.5} roughness={0.45} />
          </mesh>
          {/* Capsule windows */}
          {[0, 1, 2].map((i) => {
            const a = (i / 3) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.016, 0.016, Math.sin(a) * 0.016]}>
                <sphereGeometry args={[0.0028, 8, 8]} />
                <meshBasicMaterial color="#38bdf8" />
              </mesh>
            );
          })}
          {/* Trunk */}
          <mesh position={[0, -0.012, 0]}>
            <cylinderGeometry args={[0.024, 0.024, 0.03, 24]} />
            <meshStandardMaterial color="#3a3f47" metalness={0.4} roughness={0.5} />
          </mesh>
          {/* Trunk body-mounted solar array (curved wrap) */}
          <mesh position={[0, -0.012, 0.025]}>
            <boxGeometry args={[0.05, 0.028, 0.002]} />
            <meshStandardMaterial color={PANEL} emissive={PANEL_EMIT} emissiveIntensity={0.4} roughness={0.3} metalness={0.5} />
          </mesh>
          <mesh position={[0, -0.012, -0.025]}>
            <boxGeometry args={[0.05, 0.028, 0.002]} />
            <meshStandardMaterial color={PANEL} emissive={PANEL_EMIT} emissiveIntensity={0.4} roughness={0.3} metalness={0.5} />
          </mesh>
          {/* Aft thrusters */}
          <Thrusters position={[0, -0.028, 0]} scale={1.2} />
        </group>
      );

    case "nav":
      // Compact boxy bus, dual symmetric wings, a downward nav-payload panel.
      return (
        <group>
          {/* Main bus */}
          <mesh>
            <boxGeometry args={[0.03, 0.03, 0.03]} />
            <meshStandardMaterial color={FOIL} metalness={0.8} roughness={0.4} />
          </mesh>
          {/* Atomic clock box (side) */}
          <mesh position={[0.016, 0.004, 0]}>
            <boxGeometry args={[0.004, 0.014, 0.014]} />
            <meshStandardMaterial color={FOIL_DARK} metalness={0.75} roughness={0.4} />
          </mesh>
          {/* Downward navigation antenna array (phased array) */}
          <mesh position={[0, -0.02, 0]}>
            <boxGeometry args={[0.026, 0.008, 0.026]} />
            <meshStandardMaterial color="#1b1d22" metalness={0.3} roughness={0.7} />
          </mesh>
          {[[-0.008, -0.008], [0.008, -0.008], [-0.008, 0.008], [0.008, 0.008], [0, 0]].map(([x, z], i) => (
            <mesh key={i} position={[x, -0.0245, z]}>
              <cylinderGeometry args={[0.0025, 0.0025, 0.001, 12]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
            </mesh>
          ))}
          {/* Star trackers on the top face */}
          <StarTracker position={[0.008, 0.016, 0.008]} rotation={[0.3, 0, 0]} />
          <StarTracker position={[-0.008, 0.016, -0.008]} rotation={[0.3, 0, 0]} />
          {/* Deployable solar wings */}
          <group ref={arrayRef}>
            <Wings span={0.07} />
          </group>
        </group>
      );

    case "eo":
      // Earth-observation bus with a downward-pointing sensor/telescope barrel.
      return (
        <group>
          {/* Bus */}
          <mesh>
            <boxGeometry args={[0.028, 0.04, 0.028]} />
            <meshStandardMaterial color={FOIL} metalness={0.8} roughness={0.4} />
          </mesh>
          {/* Nadir sensor barrel */}
          <mesh position={[0, -0.032, 0]}>
            <cylinderGeometry args={[0.012, 0.016, 0.025, 20]} />
            <meshStandardMaterial color="#15171c" metalness={0.4} roughness={0.6} />
          </mesh>
          {/* Lens / aperture */}
          <mesh position={[0, -0.045, 0]}>
            <cylinderGeometry args={[0.011, 0.011, 0.002, 20]} />
            <meshBasicMaterial color="#0a1622" />
          </mesh>
          {/* Aperture glint ring */}
          <mesh position={[0, -0.0462, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.009, 0.011, 24]} />
            <meshBasicMaterial color="#7df9ff" transparent opacity={0.5} side={THREE.DoubleSide} />
          </mesh>
          {/* Instrument baffle */}
          <mesh position={[0, -0.02, 0]}>
            <cylinderGeometry args={[0.017, 0.017, 0.004, 20]} />
            <meshStandardMaterial color="#3a3f47" metalness={0.6} roughness={0.4} />
          </mesh>
          {/* Thermal radiator on the anti-sun face */}
          <Radiator position={[0, 0.005, -0.015]} rotation={[2.6, 0, 0]} w={0.024} h={0.03} />
          {/* Downlink dish */}
          <Dish position={[0, 0.028, 0.006]} rotation={[0.5, 0, 0]} radius={0.011} />
          <Antenna position={[0.012, 0.02, -0.01]} rotation={[-0.3, 0, -0.2]} length={0.028} />
          <group ref={arrayRef}>
            <Wings span={0.066} />
          </group>
        </group>
      );

    case "science":
      // Spinner-style science bus with a wide instrument deck and side probes.
      return (
        <group>
          <mesh>
            <cylinderGeometry args={[0.016, 0.02, 0.026, 16]} />
            <meshStandardMaterial color={FOIL} metalness={0.8} roughness={0.4} />
          </mesh>
          {/* Instrument deck */}
          <mesh position={[0, 0.015, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.006, 16]} />
            <meshStandardMaterial color={METAL_DARK} metalness={0.6} roughness={0.45} />
          </mesh>
          {/* Magnetometer boom */}
          <group position={[0, 0, 0.02]} rotation={[0, 0, 0]}>
            <mesh position={[0, 0, 0.025]}>
              <cylinderGeometry args={[0.0006, 0.0006, 0.05, 6]} />
              <meshStandardMaterial color={METAL_DARK} metalness={0.7} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0, 0.05]}>
              <sphereGeometry args={[0.003, 8, 8]} />
              <meshStandardMaterial color="#ffd166" emissive="#ffd166" emissiveIntensity={0.4} metalness={0.6} roughness={0.3} />
            </mesh>
          </group>
          {/* Particle detector / telescope heads */}
          <Dish position={[0.012, 0.02, 0]} rotation={[0, 0, -0.4]} radius={0.006} color="#3a3f47" />
          <StarTracker position={[-0.01, 0.018, 0.01]} rotation={[0.4, 0, 0]} />
          <group ref={arrayRef}>
            <Wings span={0.05} h={0.02} />
          </group>
        </group>
      );

    case "cubesat":
      // Tiny cube with body-mounted cells and a simple whip antenna.
      return (
        <group>
          <mesh>
            <boxGeometry args={[0.02, 0.02, 0.03]} />
            <meshStandardMaterial color={PANEL} emissive={PANEL_EMIT} emissiveIntensity={0.35} metalness={0.5} roughness={0.4} />
          </mesh>
          {/* Face detail panels */}
          <mesh position={[0, 0.0102, 0]}>
            <boxGeometry args={[0.019, 0.0004, 0.029]} />
            <meshStandardMaterial color={PANEL} emissive={PANEL_EMIT} emissiveIntensity={0.45} roughness={0.3} metalness={0.6} />
          </mesh>
          {/* Deployable antenna */}
          <Antenna position={[0, 0.011, 0]} length={0.03} />
          <Antenna position={[0.0055, 0.011, 0.0055]} rotation={[0.5, 0, 0]} length={0.02} />
          {/* Camera/sensor nub */}
          <mesh position={[0, -0.0105, 0]}>
            <cylinderGeometry args={[0.0038, 0.0038, 0.002, 10]} />
            <meshStandardMaterial color="#1b1d22" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0, -0.0116, 0]}>
            <sphereGeometry args={[0.0026, 8, 8]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
        </group>
      );

    default: // comsat — boxy GEO bus, big wings, a comms dish on top
      return (
        <group>
          {/* Main bus */}
          <mesh>
            <boxGeometry args={[0.03, 0.034, 0.03]} />
            <meshStandardMaterial color={FOIL} metalness={0.82} roughness={0.38} />
          </mesh>
          {/* Bus panel seam details */}
          <mesh position={[0, 0.0172, 0]}>
            <boxGeometry args={[0.029, 0.0004, 0.029]} />
            <meshStandardMaterial color={FOIL_DARK} metalness={0.8} roughness={0.45} />
          </mesh>
          {/* Apogee kick motor bell (aft) */}
          <mesh position={[0, -0.024, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.008, 0.014, 16, 1, true]} />
            <meshStandardMaterial color="#2b2f36" metalness={0.7} roughness={0.4} side={THREE.DoubleSide} />
          </mesh>
          {/* North/south solar wings */}
          <group ref={arrayRef}>
            <Wings span={0.085} h={0.03} />
          </group>
          {/* Main communications dish (Earth-pointing) */}
          <Dish position={[0, 0.028, 0.006]} rotation={[0.5, 0, 0]} radius={0.013} />
          {/* Secondary spot-beam dish */}
          <Dish position={[0.014, 0.01, -0.014]} rotation={[1.6, 0.4, 0]} radius={0.006} color={METAL_DARK} />
          {/* Telemetry antennas */}
          <Antenna position={[-0.014, 0.018, 0.01]} rotation={[0.2, 0, 0.3]} length={0.026} />
          <Antenna position={[0.014, -0.016, -0.008]} rotation={[-0.4, 0, -0.2]} length={0.022} />
          {/* Body-mounted radiator strip */}
          <Radiator position={[0, 0, 0.0152]} w={0.028} h={0.01} />
        </group>
      );
  }
}
