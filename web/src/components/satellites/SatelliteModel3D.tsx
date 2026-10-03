"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ElementRef, type ReactNode, type RefObject } from "react";
import * as THREE from "three";
import { useInView } from "@/components/three/useInView";
import ISSModel from "@/components/three/ISSModel";
import { archetype, profile, type Archetype } from "./satelliteProfile";
import {
  Dish,
  Radiator,
  SolarWing,
  Sunshade,
  Thruster,
  Truss,
  Whip,
  useSpaceEnvironment,
  useSpacecraftMaterials,
  type SpacecraftMaterials,
} from "@/components/three/spacecraftParts";

export interface SatModelSpec {
  purpose?: string | null;
  orbitType?: string | null;
  name?: string | null;
}

/** Sun direction. Shared by the key light and the environment map so the
 *  specular highlight and the cast shadows agree about where the sun is. */
const SUN: [number, number, number] = [7, 8.5, 5.5];

// ---------------------------------------------------------------------------
// Shared sub-assemblies
// ---------------------------------------------------------------------------

/** Blanketed bus box with corner longerons and equipment fittings. */
function FoilBus({ m, w, h, d, children }: { m: SpacecraftMaterials; w: number; h: number; d: number; children?: ReactNode }) {
  return (
    <group>
      <mesh material={m.foil} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
      </mesh>
      {/* Corner longerons: the structural edges the blanket is laced over */}
      {[
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ].map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} position={[(sx * w) / 2, 0, (sz * d) / 2]} material={m.darkMetal} castShadow>
          <boxGeometry args={[0.05, h + 0.012, 0.05]} />
        </mesh>
      ))}
      {/* Deck rings top and bottom, where the panels bolt to the frame */}
      {[-1, 1].map((sy) => (
        <mesh key={sy} position={[0, (sy * h) / 2, 0]} material={m.metal} castShadow>
          <boxGeometry args={[w + 0.02, 0.035, d + 0.02]} />
        </mesh>
      ))}
      {children}
    </group>
  );
}

/** Star tracker — baffled tube on a mount. Every three-axis craft carries two. */
function StarTracker({ m }: { m: SpacecraftMaterials }) {
  return (
    <group>
      <mesh material={m.black} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.22, 12]} />
      </mesh>
      <mesh position={[0, 0.13, 0]} material={m.metal}>
        <cylinderGeometry args={[0.08, 0.075, 0.04, 12]} />
      </mesh>
      <mesh position={[0, -0.13, 0]} material={m.darkMetal}>
        <boxGeometry args={[0.14, 0.05, 0.14]} />
      </mesh>
    </group>
  );
}

/** Four-nozzle RCS pod at a bus corner. */
function RcsPod({ m }: { m: SpacecraftMaterials }) {
  return (
    <group>
      <mesh material={m.darkMetal} castShadow>
        <boxGeometry args={[0.16, 0.1, 0.16]} />
      </mesh>
      <group position={[0, -0.09, 0]} rotation={[0, 0, Math.PI]}>
        <Thruster m={m} scale={0.65} />
      </group>
      <group position={[0.1, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <Thruster m={m} scale={0.5} />
      </group>
    </group>
  );
}

/** Planar phased-array face: bezel, radome, and the element lattice on top. */
function PhasedArray({ m, w, h, cols = 6, rows = 4 }: { m: SpacecraftMaterials; w: number; h: number; cols?: number; rows?: number }) {
  return (
    <group>
      <mesh material={m.metal} castShadow receiveShadow>
        <boxGeometry args={[w, 0.05, h]} />
      </mesh>
      <mesh position={[0, -0.028, 0]} material={m.black}>
        <boxGeometry args={[w - 0.05, 0.02, h - 0.05]} />
      </mesh>
      {/* Element lattice. Real geometry, not a wireframe overlay. */}
      {Array.from({ length: cols - 1 }, (_, i) => (
        <mesh key={`c${i}`} position={[-w / 2 + (w * (i + 1)) / cols, -0.04, 0]} material={m.darkMetal}>
          <boxGeometry args={[0.012, 0.012, h - 0.06]} />
        </mesh>
      ))}
      {Array.from({ length: rows - 1 }, (_, i) => (
        <mesh key={`r${i}`} position={[0, -0.04, -h / 2 + (h * (i + 1)) / rows]} material={m.darkMetal}>
          <boxGeometry args={[w - 0.06, 0.012, 0.012]} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Archetypes
// ---------------------------------------------------------------------------

/** GPS/GLONASS/Galileo block: cuboid bus, helix array aimed at the Earth. */
function NavigationSat({ m }: { m: SpacecraftMaterials }) {
  // Two concentric rings of helical elements — the signature of a nav payload.
  const helices = useMemo(() => {
    const out: { x: number; z: number; r: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      out.push({ x: Math.cos(a) * 0.26, z: Math.sin(a) * 0.26, r: 0.085 });
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      out.push({ x: Math.cos(a) * 0.55, z: Math.sin(a) * 0.55, r: 0.07 });
    }
    return out;
  }, []);

  return (
    <group>
      <FoilBus m={m} w={1.15} h={1.35} d={1.15}>
        {/* Thermal radiators on the two faces the wings leave free */}
        {[-1, 1].map((s) => (
          <group key={s} position={[0, 0, s * 0.59]} rotation={[Math.PI / 2, 0, 0]}>
            <Radiator m={m} w={1.0} h={1.15} />
          </group>
        ))}
        <group position={[0.42, 0.62, 0.3]}>
          <StarTracker m={m} />
        </group>
        <group position={[-0.42, 0.62, -0.3]} rotation={[0.3, 0, 0.2]}>
          <StarTracker m={m} />
        </group>
      </FoilBus>

      {/* Earth-facing antenna deck */}
      <group position={[0, -0.72, 0]}>
        <mesh material={m.darkMetal} castShadow receiveShadow>
          <boxGeometry args={[1.5, 0.09, 1.5]} />
        </mesh>
        <mesh position={[0, -0.05, 0]} material={m.black}>
          <boxGeometry args={[1.42, 0.03, 1.42]} />
        </mesh>
        {helices.map((h, i) => (
          <group key={i} position={[h.x, -0.26, h.z]}>
            <mesh material={m.gold} castShadow>
              <cylinderGeometry args={[h.r, h.r, 0.42, 10, 1, true]} />
            </mesh>
            {[-0.15, 0, 0.15].map((y) => (
              <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.metal}>
                <torusGeometry args={[h.r, 0.009, 4, 12]} />
              </mesh>
            ))}
            <mesh position={[0, -0.23, 0]} material={m.darkMetal}>
              <cylinderGeometry args={[h.r + 0.018, h.r + 0.018, 0.035, 10]} />
            </mesh>
          </group>
        ))}
        {/* Laser retro-reflector array, which these craft all carry */}
        <mesh position={[0, -0.07, 0.62]} material={m.optic}>
          <boxGeometry args={[0.34, 0.06, 0.16]} />
        </mesh>
      </group>

      <SolarWing m={m} side={1} panels={2} panelLength={1.5} width={1.15} boom={0.45} />
      <SolarWing m={m} side={-1} panels={2} panelLength={1.5} width={1.15} boom={0.45} />

      {/* Zenith deck: S-band whips and the cross-link horns */}
      <group position={[0.3, 0.7, 0]}>
        <Whip m={m} length={0.85} />
      </group>
      <group position={[-0.3, 0.7, 0.3]}>
        <Whip m={m} length={0.6} />
      </group>
      <group position={[0, 0.78, -0.35]} rotation={[-0.4, 0, 0]}>
        <mesh material={m.gold} castShadow>
          <cylinderGeometry args={[0.16, 0.07, 0.3, 14]} />
        </mesh>
      </group>
      <group position={[0.5, -0.62, 0.5]}>
        <RcsPod m={m} />
      </group>
      <group position={[-0.5, -0.62, -0.5]}>
        <RcsPod m={m} />
      </group>
    </group>
  );
}

/** GEO communications bus: big nadir reflector plus east/west side dishes. */
function ComSat({ m }: { m: SpacecraftMaterials }) {
  return (
    <group>
      <FoilBus m={m} w={1.25} h={1.45} d={1.25}>
        <group position={[0.43, 0.68, 0.33]}>
          <StarTracker m={m} />
        </group>
      </FoilBus>

      {/* Nadir main reflector */}
      <group position={[0, -0.78, 0]} rotation={[Math.PI, 0, 0]}>
        <Dish m={m} radius={0.72} depth={0.26} />
      </group>

      {/* Deployed east/west reflectors on their pointing mechanisms */}
      {[1, -1].map((s) => (
        <group key={s} position={[0, -0.1, s * 0.78]} rotation={[s * (Math.PI / 2 - 0.5), 0, 0]}>
          <mesh position={[0, -0.12, 0]} material={m.darkMetal} castShadow>
            <cylinderGeometry args={[0.07, 0.09, 0.2, 12]} />
          </mesh>
          <Dish m={m} radius={0.44} depth={0.17} />
        </group>
      ))}

      {/* Feed-horn cluster on the Earth deck, beside the main reflector */}
      <group position={[0.52, -0.6, 0]}>
        {[
          [0, 0],
          [0.17, 0.1],
          [0.17, -0.1],
        ].map(([dx, dz], i) => (
          <mesh key={i} position={[dx, -0.14, dz]} material={m.gold} castShadow>
            <cylinderGeometry args={[0.1, 0.045, 0.28, 12]} />
          </mesh>
        ))}
      </group>

      {/* North/south radiator panels, the hot side of a GEO bus */}
      <group position={[0, 0, 0.64]} rotation={[Math.PI / 2, 0, 0]}>
        <Radiator m={m} w={1.1} h={1.25} />
      </group>

      <SolarWing m={m} side={1} panels={3} panelLength={1.45} width={1.15} boom={0.55} />
      <SolarWing m={m} side={-1} panels={3} panelLength={1.45} width={1.15} boom={0.55} />

      {/* Apogee motor on the anti-Earth face */}
      <group position={[0, 0.8, 0]} rotation={[Math.PI, 0, 0]}>
        <mesh material={m.darkMetal} castShadow>
          <cylinderGeometry args={[0.18, 0.1, 0.26, 16]} />
        </mesh>
        <mesh position={[0, 0.2, 0]} material={m.metal}>
          <cylinderGeometry args={[0.1, 0.1, 0.16, 12]} />
        </mesh>
      </group>
      <group position={[0.55, 0.72, 0.55]}>
        <RcsPod m={m} />
      </group>
      <group position={[-0.55, 0.72, -0.55]}>
        <RcsPod m={m} />
      </group>
    </group>
  );
}

/** LEO constellation flat-pack: slab chassis, one wing, phased arrays below. */
function FlatSat({ m }: { m: SpacecraftMaterials }) {
  return (
    <group>
      {/* Chassis: stack-launched craft are a plate, not a box */}
      <mesh material={m.foil} castShadow receiveShadow>
        <boxGeometry args={[2.1, 0.18, 1.25]} />
      </mesh>
      <mesh position={[0, 0.1, 0]} material={m.white} receiveShadow>
        <boxGeometry args={[2.0, 0.03, 1.15]} />
      </mesh>
      {/* Stiffening ribs along the plate */}
      {[-0.7, 0, 0.7].map((x) => (
        <mesh key={x} position={[x, 0.115, 0]} material={m.darkMetal}>
          <boxGeometry args={[0.05, 0.035, 1.2]} />
        </mesh>
      ))}
      {/* Avionics and propellant boxes, so the deck isn't a bare plate */}
      <mesh position={[0.35, 0.18, 0.3]} material={m.darkMetal} castShadow>
        <boxGeometry args={[0.5, 0.14, 0.34]} />
      </mesh>
      <mesh position={[-0.35, 0.2, -0.1]} rotation={[0, 0, Math.PI / 2]} material={m.metal} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.5, 18]} />
      </mesh>

      {/* Nadir phased arrays — the user-link face */}
      {[-0.65, 0, 0.65].map((x) => (
        <group key={x} position={[x, -0.13, 0]}>
          <PhasedArray m={m} w={0.6} h={1.1} cols={5} rows={7} />
        </group>
      ))}

      {/* Optical inter-satellite terminals on the top deck */}
      {[-0.75, 0.75].map((x) => (
        <group key={x} position={[x, 0.22, -0.38]}>
          <mesh material={m.darkMetal} castShadow>
            <cylinderGeometry args={[0.13, 0.15, 0.16, 14]} />
          </mesh>
          <mesh position={[0, 0.12, 0]} rotation={[0.35, 0, 0]} material={m.optic}>
            <cylinderGeometry args={[0.1, 0.1, 0.1, 14]} />
          </mesh>
        </group>
      ))}

      {/* Hall thruster, aft */}
      <group position={[-1.0, 0, 0.42]} rotation={[0, 0, Math.PI / 2]}>
        <mesh material={m.darkMetal} castShadow>
          <cylinderGeometry args={[0.13, 0.13, 0.16, 16]} />
        </mesh>
        <mesh position={[0, 0.1, 0]} material={m.accent}>
          <torusGeometry args={[0.08, 0.025, 6, 16]} />
        </mesh>
      </group>
      <group position={[0.95, 0.2, 0.45]} rotation={[0, 0, -0.2]}>
        <StarTracker m={m} />
      </group>

      {/* The single long wing, hinged along one edge and tilted to the sun */}
      <group position={[0, 0.05, 0.63]} rotation={[0.42, 0, 0]}>
        <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.metal} castShadow>
          <cylinderGeometry args={[0.045, 0.045, 1.9, 10]} />
        </mesh>
        {Array.from({ length: 4 }, (_, i) => {
          const len = 1.2;
          const z = 0.12 + len / 2 + i * (len + 0.05);
          return (
            <group key={i} position={[0, 0, z]}>
              <mesh material={m.cellBack} castShadow receiveShadow>
                <boxGeometry args={[2.0, 0.03, len]} />
              </mesh>
              <mesh position={[0, 0.022, 0]} material={m.cells} receiveShadow>
                <boxGeometry args={[1.94, 0.012, len - 0.06]} />
              </mesh>
              {[-1, 1].map((s) => (
                <mesh key={s} position={[(s * 2.0) / 2 - s * 0.02, 0.024, 0]} material={m.metal}>
                  <boxGeometry args={[0.04, 0.02, len]} />
                </mesh>
              ))}
              <mesh position={[0, 0.024, (len / 2) * -1 - 0.025]} rotation={[0, 0, Math.PI / 2]} material={m.darkMetal}>
                <cylinderGeometry args={[0.025, 0.025, 1.95, 8]} />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

/** Landsat-style imager: nadir instrument under a shade, one offset wing. */
function ImagerSat({ m }: { m: SpacecraftMaterials }) {
  return (
    <group>
      <FoilBus m={m} w={1.05} h={1.4} d={1.05}>
        <group position={[0, 0, 0.56]} rotation={[Math.PI / 2, 0, 0]}>
          <Radiator m={m} w={0.95} h={1.3} />
        </group>
        <group position={[0.38, 0.6, -0.3]} rotation={[0.2, 0, 0]}>
          <StarTracker m={m} />
        </group>
      </FoilBus>

      {/* Instrument bay below the bus: aperture, shade, and the cryo radiator */}
      <group position={[0, -0.9, 0]}>
        <mesh material={m.foil} castShadow receiveShadow>
          <boxGeometry args={[1.0, 0.44, 1.0]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0, s * 0.23, 0]} material={m.metal}>
            <boxGeometry args={[1.02, 0.03, 1.02]} />
          </mesh>
        ))}
        <group position={[0, -0.5, 0]} rotation={[Math.PI, 0, 0]}>
          <Sunshade m={m} w={0.78} h={0.78} depth={0.58} />
        </group>
        {/* Scan mirror, visible down the shade */}
        <mesh position={[0, -0.26, 0]} rotation={[0, 0.6, 0]} material={m.optic}>
          <cylinderGeometry args={[0.3, 0.3, 0.04, 24]} />
        </mesh>
        {/* Passive cooler, angled away from the sun */}
        <group position={[0.42, -0.1, -0.5]} rotation={[0.5, 0, 0.3]}>
          <Radiator m={m} w={0.5} h={0.45} />
        </group>
      </group>

      {/* Single wing, offset to one side — the classic Landsat asymmetry */}
      <SolarWing m={m} side={1} panels={3} panelLength={1.25} width={1.0} boom={0.5} y={0.25} tilt={-0.12} />

      {/* High-gain antenna on a deployed truss, out the other side so the craft
          is asymmetric without being lopsided */}
      <group position={[-0.5, 0.6, 0.15]} rotation={[0, 0, 0.75]}>
        <Truss m={m} length={1.2} bays={4} w={0.16} />
        <group position={[0, 1.35, 0]} rotation={[0.95, 0, -1.0]}>
          <Dish m={m} radius={0.36} depth={0.14} />
        </group>
      </group>
      <group position={[0.3, 0.75, 0.35]}>
        <Whip m={m} length={0.7} />
      </group>
      <group position={[-0.48, -0.6, 0.48]}>
        <RcsPod m={m} />
      </group>
    </group>
  );
}

/** Space telescope: baffled barrel, open aperture door, secondary on a spider. */
function TelescopeSat({ m }: { m: SpacecraftMaterials }) {
  const R = 0.66;
  const L = 2.3;
  return (
    <group position={[0, 0.1, 0]}>
      {/* Tube, open at the top so the optics inside are actually visible */}
      <mesh material={m.foil} castShadow receiveShadow>
        <cylinderGeometry args={[R, R, L, 40, 1, true]} />
      </mesh>
      {/* Inner wall, rendered back-face only so looking down the open end shows
          a dark bore rather than the lit outside of the tube */}
      <mesh>
        <cylinderGeometry args={[R - 0.02, R - 0.02, L - 0.01, 32, 1, true]} />
        <meshStandardMaterial color="#0d0f14" side={THREE.BackSide} metalness={0.3} roughness={0.85} />
      </mesh>
      {/* Light shield rings around the outside */}
      {[0.42, 0.18].map((t) => (
        <mesh key={t} position={[0, L * t, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.metal} castShadow>
          <torusGeometry args={[R + 0.015, 0.03, 6, 36]} />
        </mesh>
      ))}
      {/* Internal baffles, stopping scattered light down the tube */}
      {[0.2, -0.05, -0.3].map((t) => (
        <mesh key={t} position={[0, L * t, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.black}>
          <torusGeometry args={[R - 0.1, 0.055, 4, 28]} />
        </mesh>
      ))}
      {/* Primary mirror at the bottom of the tube */}
      <mesh position={[0, -L / 2 + 0.12, 0]} material={m.optic}>
        <cylinderGeometry args={[R - 0.07, R - 0.07, 0.05, 36]} />
      </mesh>
      <mesh position={[0, -L / 2 + 0.16, 0]} material={m.black}>
        <cylinderGeometry args={[0.14, 0.14, 0.06, 16]} />
      </mesh>

      {/* Secondary mirror on a four-vane spider across the aperture */}
      <group position={[0, L / 2 - 0.3, 0]}>
        <mesh material={m.metal}>
          <cylinderGeometry args={[0.17, 0.17, 0.08, 20]} />
        </mesh>
        <mesh position={[0, -0.05, 0]} material={m.optic}>
          <cylinderGeometry args={[0.15, 0.15, 0.02, 20]} />
        </mesh>
        {[0, Math.PI / 2].map((a) => (
          <mesh key={a} rotation={[0, a, 0]} material={m.metal}>
            <boxGeometry args={[R * 2 - 0.04, 0.02, 0.025]} />
          </mesh>
        ))}
      </group>

      {/* Aperture ring, and the door swung back on its hinge */}
      <mesh position={[0, L / 2, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.metal} castShadow>
        <torusGeometry args={[R, 0.045, 8, 40]} />
      </mesh>
      <group position={[0, L / 2, -R]} rotation={[-0.95, 0, 0]}>
        <mesh position={[0, 0, R * 0.98]} material={m.white} castShadow>
          <cylinderGeometry args={[R * 0.97, R * 0.97, 0.05, 36]} />
        </mesh>
        {/* Hinge arms, or the door reads as a disc floating off the tube */}
        {[-0.3, 0.3].map((x) => (
          <mesh key={x} position={[x * R, 0, 0.14]} rotation={[Math.PI / 2, 0, 0]} material={m.darkMetal}>
            <cylinderGeometry args={[0.03, 0.03, 0.3, 8]} />
          </mesh>
        ))}
      </group>

      {/* Equipment section and aft bulkhead */}
      <group position={[0, -L / 2 - 0.26, 0]}>
        <mesh material={m.foil} castShadow receiveShadow>
          <boxGeometry args={[1.25, 0.5, 1.25]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[(s * 1.25) / 2, 0, 0]} material={m.metal}>
            <boxGeometry args={[0.04, 0.52, 1.27]} />
          </mesh>
        ))}
        <group position={[0, -0.33, 0]} rotation={[Math.PI, 0, 0]}>
          <Radiator m={m} w={1.1} h={1.1} />
        </group>
      </group>

      {/* Wings mounted on the barrel, edge-on to the tube */}
      <SolarWing m={m} side={1} panels={2} panelLength={1.4} width={1.2} boom={0.35} y={-0.45} />
      <SolarWing m={m} side={-1} panels={2} panelLength={1.4} width={1.2} boom={0.35} y={-0.45} />

      {/* High-gain antenna, stood off the barrel on a mast so it reads as a
          separate antenna rather than a dark port in the tube wall */}
      <group position={[0, 0.1, R + 0.12]}>
        <mesh position={[0, 0, 0.26]} rotation={[Math.PI / 2, 0, 0]} material={m.darkMetal} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.55, 10]} />
        </mesh>
        <group position={[0, 0.06, 0.58]} rotation={[1.5, 0, 0.75]}>
          <Dish m={m} radius={0.36} depth={0.14} />
        </group>
      </group>
      <group position={[0, -0.2, -R - 0.15]} rotation={[-0.5, 0, 0]}>
        <StarTracker m={m} />
      </group>
    </group>
  );
}

/** Polar weather platform: radiometer drum, nadir sounders, crossed dipoles. */
function WeatherSat({ m }: { m: SpacecraftMaterials }) {
  return (
    <group>
      <FoilBus m={m} w={1.1} h={1.5} d={1.1}>
        <group position={[0, 0, -0.58]} rotation={[Math.PI / 2, 0, 0]}>
          <Radiator m={m} w={1.0} h={1.4} />
        </group>
      </FoilBus>

      {/* Scanning radiometer. Axis across the craft, not along the view: drum-on
          it was just a dark disc, side-on it reads as a rotating instrument. */}
      <group position={[0, 0.2, 0.86]} rotation={[0, 0, Math.PI / 2]}>
        <mesh material={m.metal} castShadow receiveShadow>
          <cylinderGeometry args={[0.38, 0.38, 0.8, 28]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0, s * 0.42, 0]} material={m.darkMetal}>
            <cylinderGeometry args={[0.4, 0.4, 0.06, 28]} />
          </mesh>
        ))}
        {/* Aperture slot in the drum wall, and the scan mirror behind it */}
        <mesh position={[0.37, 0.12, 0]} rotation={[0, 0, Math.PI / 2]} material={m.black}>
          <boxGeometry args={[0.3, 0.1, 0.34]} />
        </mesh>
        <mesh position={[0.3, 0.12, 0]} rotation={[0, 0, 0.9]} material={m.optic}>
          <cylinderGeometry args={[0.15, 0.15, 0.03, 20]} />
        </mesh>
        {/* Stringers around the drum: the give-away that it spins */}
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.385, 0, Math.sin(a) * 0.385]} rotation={[0, -a, 0]} material={m.darkMetal}>
              <boxGeometry args={[0.02, 0.78, 0.045]} />
            </mesh>
          );
        })}
      </group>

      {/* Nadir sounder heads, looking down the gravity gradient */}
      <group position={[0, -0.82, 0]}>
        <mesh material={m.foil} castShadow receiveShadow>
          <boxGeometry args={[1.0, 0.3, 1.0]} />
        </mesh>
        <mesh position={[0, 0.16, 0]} material={m.metal}>
          <boxGeometry args={[1.02, 0.03, 1.02]} />
        </mesh>
        {[-0.26, 0.26].map((x) => (
          <group key={x} position={[x, -0.3, 0]}>
            <mesh material={m.metal} castShadow>
              <cylinderGeometry args={[0.2, 0.26, 0.3, 20]} />
            </mesh>
            <mesh position={[0, -0.17, 0]} material={m.optic}>
              <cylinderGeometry args={[0.2, 0.2, 0.04, 20]} />
            </mesh>
          </group>
        ))}
        {/* Microwave horn, offset from the sounders */}
        <group position={[0, -0.26, 0.42]} rotation={[0.25, 0, 0]}>
          <mesh material={m.gold} castShadow>
            <cylinderGeometry args={[0.2, 0.08, 0.34, 4]} />
          </mesh>
        </group>
      </group>

      {/* One wing, as polar sun-synchronous platforms carry */}
      <SolarWing m={m} side={-1} panels={3} panelLength={1.3} width={1.1} boom={0.5} y={0.2} tilt={0.15} />

      {/* Crossed-dipole VHF/UHF data link on the zenith deck */}
      <group position={[0.1, 0.82, 0]}>
        <mesh position={[0, 0.3, 0]} material={m.metal}>
          <cylinderGeometry args={[0.03, 0.03, 0.6, 8]} />
        </mesh>
        {[0, Math.PI / 2].map((a) => (
          <mesh key={a} position={[0, 0.58, 0]} rotation={[Math.PI / 2, a, 0]} material={m.metal}>
            <cylinderGeometry args={[0.016, 0.016, 0.95, 6]} />
          </mesh>
        ))}
        <mesh position={[0, 0.42, 0]} material={m.darkMetal}>
          <boxGeometry args={[0.1, 0.08, 0.1]} />
        </mesh>
      </group>
      <group position={[0.42, 0.78, -0.35]}>
        <Whip m={m} length={0.75} />
      </group>
      <group position={[0.46, -0.65, 0.46]}>
        <RcsPod m={m} />
      </group>
    </group>
  );
}

/** Crewed / logistics vehicle: pressurised module with a docking mechanism. */
function StationCraft({ m }: { m: SpacecraftMaterials }) {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={m.white} castShadow receiveShadow>
        <cylinderGeometry args={[0.72, 0.72, 2.0, 32]} />
      </mesh>
      {[-0.7, 0, 0.7].map((z) => (
        <mesh key={z} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]} material={m.darkMetal}>
          <cylinderGeometry args={[0.745, 0.745, 0.07, 32]} />
        </mesh>
      ))}
      {/* MLI-wrapped service section aft */}
      <mesh position={[0, 0, -1.25]} rotation={[Math.PI / 2, 0, 0]} material={m.foil} castShadow>
        <cylinderGeometry args={[0.6, 0.6, 0.6, 24]} />
      </mesh>
      <group position={[0, 0, -1.65]} rotation={[-Math.PI / 2, 0, 0]}>
        <Thruster m={m} scale={2.4} />
      </group>

      {/* Forward docking mechanism */}
      <group position={[0, 0, 1.2]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh material={m.metal} castShadow>
          <cylinderGeometry args={[0.34, 0.44, 0.38, 24]} />
        </mesh>
        <mesh position={[0, 0.22, 0]} material={m.darkMetal}>
          <torusGeometry args={[0.33, 0.035, 8, 24]} />
        </mesh>
      </group>

      {/* Hatch window, so the scale reads as crewed */}
      <mesh position={[0, -0.72, 0.2]} rotation={[0, 0, 0]} material={m.optic}>
        <cylinderGeometry args={[0.18, 0.18, 0.04, 16]} />
      </mesh>

      <SolarWing m={m} side={1} panels={3} panelLength={1.3} width={1.1} boom={0.4} z={-0.4} />
      <SolarWing m={m} side={-1} panels={3} panelLength={1.3} width={1.1} boom={0.4} z={-0.4} />
      <group position={[0, 0.8, -0.3]}>
        <Whip m={m} length={0.8} />
      </group>
    </group>
  );
}

/** Fallback bus for uncategorised payloads: box, two wings, omni + small dish. */
function GenericSat({ m }: { m: SpacecraftMaterials }) {
  return (
    <group>
      <FoilBus m={m} w={1.1} h={1.3} d={1.1}>
        <group position={[0, 0, 0.58]} rotation={[Math.PI / 2, 0, 0]}>
          <Radiator m={m} w={1.0} h={1.2} />
        </group>
        <group position={[0.4, 0.58, -0.32]} rotation={[0.25, 0, 0]}>
          <StarTracker m={m} />
        </group>
      </FoilBus>
      <SolarWing m={m} side={1} panels={3} panelLength={1.35} width={1.1} boom={0.5} />
      <SolarWing m={m} side={-1} panels={3} panelLength={1.35} width={1.1} boom={0.5} />
      <group position={[0, -0.78, 0.1]} rotation={[Math.PI, 0, 0]}>
        <Dish m={m} radius={0.42} depth={0.16} />
      </group>
      <group position={[0, 0.68, 0]}>
        <Whip m={m} length={0.95} />
      </group>
      <group position={[0.45, -0.58, -0.45]}>
        <RcsPod m={m} />
      </group>
      {/* Instrument package, so the bus isn't a bare box */}
      <mesh position={[0.32, -0.72, -0.3]} material={m.black} castShadow>
        <boxGeometry args={[0.3, 0.24, 0.3]} />
      </mesh>
    </group>
  );
}

const ARCHETYPES: Record<Archetype, (p: { m: SpacecraftMaterials }) => JSX.Element> = {
  navigation: NavigationSat,
  comsat: ComSat,
  flatsat: FlatSat,
  imager: ImagerSat,
  telescope: TelescopeSat,
  weather: WeatherSat,
  station: StationCraft,
  generic: GenericSat,
};

// Presentation attitude. Head-on, a wing span foreshortens to nothing, so each
// craft is turned until its longest axis runs across the frame.
const POSE: Partial<Record<Archetype, [number, number, number]>> = {
  // Tipped so the user-link face is in view; the array carries a matching
  // counter-rotation on its hinge, as it does in flight when it tracks the sun.
  flatsat: [-0.36, -1.04, 0.06],
  station: [0.2, -1.1, 0],
};
const DEFAULT_POSE: [number, number, number] = [0.16, 0.5, 0.06];

function Satellite({ purpose, orbitType, seed }: { purpose?: string | null; orbitType?: string | null; seed: number }) {
  const { body } = profile(purpose);
  const m = useSpacecraftMaterials(body, seed);
  const kind = archetype(purpose, orbitType);
  const Craft = ARCHETYPES[kind];

  return (
    <group rotation={POSE[kind] ?? DEFAULT_POSE}>
      <Craft m={m} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

/**
 * Recentres its subtree on the origin and pulls the camera back to the distance
 * that just contains it. The archetypes have very different extents — a
 * telescope barrel against a 6-unit flat-pack wing — and the previous fixed
 * camera left models cropped and sitting low in the frame.
 */
function FitFrame({ fitKey, children, onFit }: { fitKey: string; children: ReactNode; onFit: (radius: number) => void }) {
  const ref = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  // Keyed on the craft, not on every render: refitting after the user has
  // zoomed would yank the camera back each time the scene re-renders.
  useLayoutEffect(() => {
    const g = ref.current;
    if (!g) return;
    g.position.set(0, 0, 0);
    const box = new THREE.Box3().setFromObject(g);
    if (box.isEmpty()) return;
    // Centre on the bounding box. Centring only partway leaves the craft's
    // geometric middle off the origin the camera looks at, which on a lopsided
    // design — Starlink is one flat bus with a single long boom — parks the body
    // in a corner and shrinks everything to keep the far tip in frame.
    const shift = box.getCenter(new THREE.Vector3()).multiplyScalar(-1);
    g.position.copy(shift);
    g.updateMatrixWorld(true);

    // Fit on the projected corners of every mesh, not on one bounding sphere. A
    // wing span pointing away from the camera foreshortens to nothing, and a
    // sphere fit then parks the craft at a quarter of the frame; a single outer
    // box is nearly as loose, because its corners are mostly empty space.
    const corners: THREE.Vector3[] = [];
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    g.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox;
      if (!b) return;
      for (const sx of [b.min.x, b.max.x])
        for (const sy of [b.min.y, b.max.y])
          for (const sz of [b.min.z, b.max.z]) corners.push(new THREE.Vector3(sx, sy, sz).applyMatrix4(o.matrixWorld));
    });
    if (!corners.length) return;
    const dir = new THREE.Vector3(0.82, 0.36, 1).normalize();
    const place = (d: number) => {
      camera.position.copy(dir).multiplyScalar(d);
      camera.near = Math.max(0.05, d - radius * 2);
      camera.far = d + radius * 4;
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld(true);
      camera.updateProjectionMatrix();
      let extent = 0;
      for (const c of corners) {
        const p = c.clone().project(camera);
        extent = Math.max(extent, Math.abs(p.x), Math.abs(p.y));
      }
      return extent;
    };

    let dist = radius * 2.6;
    for (let pass = 0; pass < 6; pass++) dist = Math.max(radius * 1.05, (dist * place(dist)) / 0.94);
    place(dist);
    onFit(dist);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return <group ref={ref}>{children}</group>;
}

/**
 * Stops the idle drift the moment the user touches the model, for good. A model
 * that keeps turning while you are trying to look at one face is the single most
 * annoying thing about a 3D viewer.
 *
 * Writes `autoRotate` straight onto the controls instance rather than going
 * through React state. Both the `onStart` prop and a listener on the canvas —
 * bubble or capture — failed to stop it here; the controls read this field every
 * frame, so setting it directly is the one route that cannot be missed. State is
 * still updated so the prop agrees on the next render.
 */
function useStopDriftOnInteract(
  controls: RefObject<{ autoRotate: boolean } | null>,
  setDrifting: (v: boolean) => void,
) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const stop = () => {
      if (controls.current) controls.current.autoRotate = false;
      setDrifting(false);
    };
    el.addEventListener("pointerdown", stop, true);
    el.addEventListener("wheel", stop, { passive: true, capture: true });
    return () => {
      el.removeEventListener("pointerdown", stop, true);
      el.removeEventListener("wheel", stop, true);
    };
  }, [gl, controls, setDrifting]);
}

function SatelliteScene({ spec }: { spec: SatModelSpec }) {
  const [dist, setDist] = useState(10);
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  // Drifts until touched, then stops for good — a model that keeps turning
  // while you are trying to look at one face is worse than no motion at all.
  const [drifting, setDrifting] = useState(true);

  useSpaceEnvironment(SUN);

  useStopDriftOnInteract(controls, setDrifting);

  const seed = useMemo(() => {
    let h = 2166136261;
    const s = spec.name || "sat";
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }, [spec.name]);

  const onFit = useCallback((d: number) => setDist(d), []);

  return (
    <>
      {/* Sun: hard, bright, and the only shadow caster */}
      <directionalLight
        position={SUN}
        intensity={4.2}
        color="#fff4e2"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />
      {/* Earthshine from below and a cold rim from behind, so the shadow side
          still has form instead of going to flat black */}
      <hemisphereLight args={["#1a2130", "#2c5490", 0.95]} />
      <directionalLight position={[-6, 1.5, -6]} intensity={0.55} color="#8fd7ff" />
      <directionalLight position={[1, -7, 2]} intensity={0.55} color="#4d7cc4" />
      <ambientLight intensity={0.22} />

      <FitFrame fitKey={`${spec.purpose}|${spec.orbitType}|${seed}`} onFit={onFit}>
        <Satellite purpose={spec.purpose} orbitType={spec.orbitType} seed={seed} />
      </FitFrame>

      <OrbitControls
        ref={controls}
        enablePan={false}
        minDistance={dist * 0.35}
        maxDistance={dist * 2.4}
        autoRotate={drifting}
        autoRotateSpeed={0.45}
        // Via the prop, not an effect on the ref: the ref can still be null when
        // a mount effect runs, and a missed listener leaves the model spinning
        // under the user's cursor for good.
        onStart={() => setDrifting(false)}
      />
    </>
  );
}

/** The ISS keeps its own model and its original rig. */
function IssScene() {
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const [drifting, setDrifting] = useState(true);

  useStopDriftOnInteract(controls, setDrifting);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[6, 8, 5]} intensity={1.5} />
      <directionalLight position={[-5, -2, -4]} intensity={0.4} color="#7df9ff" />
      <group scale={[22, 22, 22]}>
        <ISSModel />
      </group>
      <OrbitControls
        ref={controls}
        enablePan={false}
        minDistance={3}
        maxDistance={12}
        autoRotate={drifting}
        autoRotateSpeed={0.45}
        onStart={() => setDrifting(false)}
      />
    </>
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
        <Canvas
          shadows
          camera={{ position: [3.5, 1.8, 4], fov: 38 }}
          dpr={[1, 2]}
          frameloop={inView ? "always" : "never"}
          gl={{ antialias: true, toneMappingExposure: 1.25 }}
        >
          <color attach="background" args={["#05070f"]} />
          <Suspense fallback={<Html center>Loading…</Html>}>{isISS ? <IssScene /> : <SatelliteScene spec={spec} />}</Suspense>
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
