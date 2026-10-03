"use client";

import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

// Shared, procedurally generated building blocks for the satellite detail model.
//
// Everything here is drawn in-process onto a <canvas> or assembled from three's
// primitives: the repo carries no model or texture assets, and we are not adding
// any. The point of the module is that a spacecraft reads as a spacecraft mostly
// through *surface* — gold MLI blanket, a visible photovoltaic cell grid, bright
// machined fittings — so the parts below own the materials, and the archetypes in
// SatelliteModel3D.tsx only place them.

const TEX = 256;

/** xorshift32 — deterministic, so a given satellite's foil wrinkles never move. */
function rand(seed: number) {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

function canvas2d(w = TEX, h = TEX) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, g: c.getContext("2d")! };
}

function toTexture(c: HTMLCanvasElement, repeat: [number, number] = [1, 1]) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  return t;
}

/** Photovoltaic blanket: cell grid with interconnect busbars and inter-cell gaps. */
function solarCellTexture() {
  const { c, g } = canvas2d();
  g.fillStyle = "#07122b";
  g.fillRect(0, 0, TEX, TEX);

  const n = 4; // cells per tile; the tile then repeats along the array
  const pad = 3;
  const size = TEX / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const px = x * size + pad;
      const py = y * size + pad;
      const w = size - pad * 2;
      const grad = g.createLinearGradient(px, py, px + w, py + w);
      grad.addColorStop(0, "#1d3f84");
      grad.addColorStop(0.5, "#13295c");
      grad.addColorStop(1, "#0d1f49");
      g.fillStyle = grad;
      g.fillRect(px, py, w, w);

      // Busbars: the thin silver fingers that give cells their directional sheen
      g.strokeStyle = "rgba(190,205,235,0.5)";
      g.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const bx = px + (w * i) / 4;
        g.beginPath();
        g.moveTo(bx, py + 1);
        g.lineTo(bx, py + w - 1);
        g.stroke();
      }
      g.strokeStyle = "rgba(210,222,245,0.7)";
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(px + 1, py + w / 2);
      g.lineTo(px + w - 1, py + w / 2);
      g.stroke();

      g.strokeStyle = "rgba(120,150,210,0.35)";
      g.lineWidth = 1;
      g.strokeRect(px + 0.5, py + 0.5, w - 1, w - 1);
    }
  }
  return c;
}

/** Multi-layer insulation: creased foil with taped seams, tinted to `base`. */
function foilTexture(base: string, seed: number) {
  const { c, g } = canvas2d();
  const rnd = rand(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, TEX, TEX);

  // Creases. MLI is a loose quilted blanket, so the highlights run in broken
  // diagonal folds rather than a regular grain.
  for (let i = 0; i < 90; i++) {
    const x = rnd() * TEX;
    const y = rnd() * TEX;
    const len = 18 + rnd() * 70;
    const a = (rnd() - 0.5) * 1.2 + Math.PI / 2;
    g.strokeStyle = rnd() > 0.5 ? `rgba(255,248,215,${0.07 + rnd() * 0.16})` : `rgba(30,22,8,${0.06 + rnd() * 0.14})`;
    g.lineWidth = 0.7 + rnd() * 2.2;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (rnd() - 0.5) * 12, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }

  // Seam tape between blanket panels, plus the stitch line down each seam
  g.strokeStyle = "rgba(255,252,235,0.22)";
  for (const t of [0.25, 0.5, 0.75]) {
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(0, t * TEX);
    g.lineTo(TEX, t * TEX);
    g.stroke();
    g.strokeStyle = "rgba(40,30,10,0.3)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, t * TEX);
    g.lineTo(TEX, t * TEX);
    g.stroke();
    g.strokeStyle = "rgba(255,252,235,0.22)";
  }
  return c;
}

/** Beta-cloth / radiator white: near-flat, with faint panel joints. */
function clothTexture(seed: number) {
  const { c, g } = canvas2d(128, 128);
  const rnd = rand(seed);
  g.fillStyle = "#e9edf4";
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(90,100,120,${rnd() * 0.07})`;
    g.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 3, 1 + rnd() * 3);
  }
  g.strokeStyle = "rgba(90,100,120,0.25)";
  g.lineWidth = 1;
  for (const t of [32, 64, 96]) {
    g.beginPath();
    g.moveTo(t, 0);
    g.lineTo(t, 128);
    g.stroke();
  }
  return c;
}

export interface SpacecraftMaterials {
  foil: THREE.MeshStandardMaterial;
  cells: THREE.MeshStandardMaterial;
  cellBack: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  /** Two-sided: reflector surfaces are shells, and a dish is viewed from both. */
  reflector: THREE.MeshStandardMaterial;
  darkMetal: THREE.MeshStandardMaterial;
  white: THREE.MeshStandardMaterial;
  black: THREE.MeshStandardMaterial;
  optic: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
}

/**
 * One material set per model instance. Spacecraft are built from a handful of
 * repeated surfaces, so sharing these keeps a ~150-mesh vehicle down to ten
 * materials and ten textures that get disposed together.
 */
export function useSpacecraftMaterials(body: string, seed: number): SpacecraftMaterials {
  const mats = useMemo(() => {
    const cellMap = toTexture(solarCellTexture(), [6, 2]);
    const foilMap = toTexture(foilTexture(body, seed));
    const clothMap = toTexture(clothTexture(seed), [2, 2]);

    return {
      // Metalness stays mid: MLI is a metallised film, but pushed high it loses
      // its diffuse term and the blanket goes black against an empty sky.
      foil: new THREE.MeshStandardMaterial({ map: foilMap, color: "#ffffff", metalness: 0.45, roughness: 0.42 }),
      cells: new THREE.MeshStandardMaterial({
        map: cellMap,
        metalness: 0.62,
        roughness: 0.26,
        emissive: new THREE.Color("#0a1b3d"),
        emissiveIntensity: 0.35,
      }),
      cellBack: new THREE.MeshStandardMaterial({ color: "#1b1f28", metalness: 0.3, roughness: 0.75 }),
      metal: new THREE.MeshStandardMaterial({ color: "#b9c2d0", metalness: 0.95, roughness: 0.22 }),
      reflector: new THREE.MeshStandardMaterial({ color: "#dde3ee", metalness: 0.9, roughness: 0.15, side: THREE.DoubleSide }),
      darkMetal: new THREE.MeshStandardMaterial({ color: "#4a515e", metalness: 0.85, roughness: 0.38 }),
      white: new THREE.MeshStandardMaterial({ map: clothMap, color: "#d3d9e4", metalness: 0.08, roughness: 0.62 }),
      // Not actually black: instrument housings that render at zero luminance
      // punch holes in the silhouette instead of reading as structure.
      black: new THREE.MeshStandardMaterial({ color: "#2b3039", metalness: 0.35, roughness: 0.62 }),
      optic: new THREE.MeshStandardMaterial({
        color: "#0a1420",
        metalness: 1,
        roughness: 0.06,
        emissive: new THREE.Color("#0c3350"),
        emissiveIntensity: 0.3,
      }),
      gold: new THREE.MeshStandardMaterial({ color: "#d8a93f", metalness: 1, roughness: 0.18 }),
      accent: new THREE.MeshStandardMaterial({ color: "#7df9ff", emissive: new THREE.Color("#1b6f78"), emissiveIntensity: 1.4, roughness: 0.4 }),
    } satisfies SpacecraftMaterials;
  }, [body, seed]);

  useEffect(
    () => () => {
      for (const m of Object.values(mats)) {
        m.map?.dispose();
        m.dispose();
      }
    },
    [mats],
  );

  return mats;
}

/**
 * Specular environment, built once per canvas from a throwaway scene: a sun
 * disc, Earth-blue bounce from below, and black everywhere else.
 *
 * Without an environment map there is nothing for metal and foil to reflect, and
 * meshStandardMaterial collapses to flat shaded colour — which is the main
 * reason the previous model read as untextured clay no matter the lighting.
 */
export function useSpaceEnvironment(sun: [number, number, number]) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const env = new THREE.Scene();
    const add = (geo: THREE.BufferGeometry, color: THREE.Color, pos: THREE.Vector3) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
      return m;
    };

    const dir = new THREE.Vector3(...sun).normalize();
    const sunGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const earthGeo = new THREE.PlaneGeometry(30, 30);
    const rimGeo = new THREE.PlaneGeometry(24, 24);
    const skyGeo = new THREE.SphereGeometry(16, 12, 10);

    // A faint all-round floor, so polished metal has something other than pure
    // black to reflect; without it every fitting reads as a silhouette.
    const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.055, 0.065, 0.085), side: THREE.BackSide }));
    env.add(sky);

    add(sunGeo, new THREE.Color(16, 15.2, 13.5), dir.clone().multiplyScalar(9));
    // Earthshine: dim, broad, and from below, which is what fills the shadow side
    add(earthGeo, new THREE.Color(0.14, 0.27, 0.5), new THREE.Vector3(0, -9, 1));
    add(rimGeo, new THREE.Color(0.06, 0.14, 0.18), dir.clone().multiplyScalar(-9));

    const pmrem = new THREE.PMREMGenerator(gl);
    const rt = pmrem.fromScene(env, 0.03);
    scene.environment = rt.texture;
    pmrem.dispose();
    sunGeo.dispose();
    earthGeo.dispose();
    rimGeo.dispose();
    skyGeo.dispose();
    env.traverse((o) => {
      if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
    });

    return () => {
      scene.environment = null;
      rt.dispose();
    };
  }, [gl, scene, sun]);
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

/**
 * A solar array wing: yoke, boom, hinge, and `panels` discrete blankets with
 * real gaps between them.
 *
 * The gaps matter — the previous model faked cell seams with a `wireframe` box,
 * and because a box face is two triangles that drew a corner-to-corner diagonal
 * across each wing. Segmentation has to be geometry (or the cell map), never
 * wireframe.
 */
export function SolarWing({
  m,
  side,
  panels = 3,
  panelLength = 1.5,
  width = 1.1,
  boom = 0.7,
  tilt = 0,
  y = 0,
  z = 0,
}: {
  m: SpacecraftMaterials;
  side: 1 | -1;
  panels?: number;
  panelLength?: number;
  width?: number;
  boom?: number;
  tilt?: number;
  y?: number;
  z?: number;
}) {
  const gap = 0.05;
  const span = panels * panelLength + (panels - 1) * gap;

  return (
    <group position={[0, y, z]} rotation={[tilt, 0, 0]}>
      {/* Drive shaft out to the wing, with its rotary joint at the bus wall */}
      <mesh position={[side * (boom / 2 + 0.3), 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.darkMetal} castShadow>
        <cylinderGeometry args={[0.05, 0.05, boom, 10]} />
      </mesh>
      <mesh position={[side * 0.32, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.metal} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.14, 16]} />
      </mesh>
      <mesh position={[side * (boom + 0.3), 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.metal} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.12, 14]} />
      </mesh>

      {Array.from({ length: panels }, (_, i) => {
        const cx = side * (boom + 0.36 + panelLength / 2 + i * (panelLength + gap));
        return (
          <group key={i} position={[cx, 0, 0]}>
            {/* Backing structure, then the cell face lifted just off it */}
            <mesh material={m.cellBack} castShadow receiveShadow>
              <boxGeometry args={[panelLength, 0.035, width]} />
            </mesh>
            <mesh position={[0, 0.024, 0]} material={m.cells} receiveShadow>
              <boxGeometry args={[panelLength - 0.07, 0.012, width - 0.07]} />
            </mesh>
            {/* Frame rails: catch the sun and read as a hard edge on the blanket */}
            {[-1, 1].map((s) => (
              <mesh key={s} position={[0, 0.026, (s * width) / 2 - s * 0.02]} material={m.metal}>
                <boxGeometry args={[panelLength, 0.022, 0.04]} />
              </mesh>
            ))}
            {[-1, 1].map((s) => (
              <mesh key={`e${s}`} position={[(s * panelLength) / 2 - s * 0.02, 0.026, 0]} material={m.metal}>
                <boxGeometry args={[0.04, 0.022, width]} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Hinge lines between blankets, where the array folds for launch */}
      {Array.from({ length: panels - 1 }, (_, i) => (
        <mesh
          key={`h${i}`}
          position={[side * (boom + 0.36 + panelLength * (i + 1) + gap * (i + 0.5)), 0, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          material={m.darkMetal}
        >
          <cylinderGeometry args={[0.03, 0.03, width * 0.96, 8]} />
        </mesh>
      ))}

      {/* Tip stiffener, so the wing doesn't end on a bare cut edge */}
      <mesh position={[side * (boom + 0.36 + span + 0.02), 0, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.metal}>
        <cylinderGeometry args={[0.035, 0.035, width, 8]} />
      </mesh>
    </group>
  );
}

/** Parabolic reflector with rim, feed horn on a tripod, and back ribs. */
export function Dish({ m, radius = 0.7, depth = 0.26 }: { m: SpacecraftMaterials; radius?: number; depth?: number }) {
  const profile = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const r = (i / steps) * radius;
      pts.push(new THREE.Vector2(r, (r * r * depth) / (radius * radius)));
    }
    return pts;
  }, [radius, depth]);
  const focal = (radius * radius) / (4 * depth);

  return (
    <group>
      <mesh material={m.reflector} castShadow receiveShadow>
        <latheGeometry args={[profile, 40]} />
      </mesh>
      {/* Rim hoop */}
      <mesh position={[0, depth, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.darkMetal}>
        <torusGeometry args={[radius, 0.022, 6, 40]} />
      </mesh>
      {/* Feed at the focus, held on a tripod */}
      <mesh position={[0, focal, 0]} material={m.gold} castShadow>
        <cylinderGeometry args={[0.09, 0.045, 0.2, 14]} />
      </mesh>
      {[0, 2.094, 4.188].map((a) => (
        <mesh
          key={a}
          position={[Math.cos(a) * radius * 0.42, focal / 2 + depth * 0.2, Math.sin(a) * radius * 0.42]}
          rotation={[Math.cos(a + Math.PI / 2) * 0.0, 0, 0]}
          material={m.metal}
        >
          <cylinderGeometry args={[0.014, 0.014, focal * 1.05, 6]} />
        </mesh>
      ))}
      {/* Back ribs and hub */}
      {[0, 1.047, 2.094, 3.141, 4.188, 5.236].map((a) => (
        <mesh key={`r${a}`} position={[(Math.cos(a) * radius) / 2, -0.03, (Math.sin(a) * radius) / 2]} rotation={[0, -a, 0]} material={m.darkMetal}>
          <boxGeometry args={[radius, 0.05, 0.03]} />
        </mesh>
      ))}
      <mesh position={[0, -0.08, 0]} material={m.darkMetal} castShadow>
        <cylinderGeometry args={[0.1, 0.13, 0.14, 12]} />
      </mesh>
    </group>
  );
}

/** Hydrazine thruster: bell plus its valve block. */
export function Thruster({ m, scale = 1 }: { m: SpacecraftMaterials; scale?: number }) {
  return (
    <group scale={scale}>
      <mesh material={m.darkMetal} castShadow>
        <cylinderGeometry args={[0.07, 0.03, 0.12, 12]} />
      </mesh>
      <mesh position={[0, 0.09, 0]} material={m.metal}>
        <boxGeometry args={[0.07, 0.07, 0.07]} />
      </mesh>
    </group>
  );
}

/** Whip / monopole antenna with its tip ball, for the low-gain links. */
export function Whip({ m, length = 0.9, r = 0.014 }: { m: SpacecraftMaterials; length?: number; r?: number }) {
  return (
    <group>
      <mesh position={[0, length / 2, 0]} material={m.metal}>
        <cylinderGeometry args={[r, r, length, 6]} />
      </mesh>
      <mesh position={[0, length, 0]} material={m.accent}>
        <sphereGeometry args={[r * 3.4, 10, 10]} />
      </mesh>
      <mesh material={m.darkMetal}>
        <cylinderGeometry args={[r * 3, r * 3, 0.06, 8]} />
      </mesh>
    </group>
  );
}

/** Flat radiator panel — white side out, so it also breaks up the silhouette. */
export function Radiator({ m, w = 1, h = 0.9 }: { m: SpacecraftMaterials; w?: number; h?: number }) {
  return (
    <group>
      <mesh material={m.white} castShadow receiveShadow>
        <boxGeometry args={[w, 0.03, h]} />
      </mesh>
      {/* Coolant loop runs, which is what makes a radiator legible as one */}
      {Array.from({ length: 3 }, (_, i) => (
        <mesh key={i} position={[0, 0.019, -h / 2 + (h * (i + 1)) / 4]} material={m.darkMetal}>
          <boxGeometry args={[w * 0.94, 0.008, 0.013]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Open sun-shade around an optical aperture.
 *
 * Blades are blanketed on the outside rather than black: the shade sits on the
 * anti-sun face, so a black one takes no key light at all and reads as a hole
 * punched in the craft instead of as the instrument it is.
 */
export function Sunshade({ m, w = 0.8, h = 0.8, depth = 0.6 }: { m: SpacecraftMaterials; w?: number; h?: number; depth?: number }) {
  const t = 0.025;
  return (
    <group>
      <mesh position={[0, 0, -h / 2]} material={m.foil} castShadow>
        <boxGeometry args={[w, depth, t]} />
      </mesh>
      <mesh position={[0, 0, h / 2]} material={m.foil} castShadow>
        <boxGeometry args={[w, depth, t]} />
      </mesh>
      <mesh position={[-w / 2, 0, 0]} material={m.foil} castShadow>
        <boxGeometry args={[t, depth, h]} />
      </mesh>
      <mesh position={[w / 2, 0, 0]} material={m.foil} castShadow>
        <boxGeometry args={[t, depth, h]} />
      </mesh>
      {/* Lip ring at the mouth, in bright metal, to catch the key light */}
      <mesh position={[0, depth / 2, 0]} material={m.metal}>
        <boxGeometry args={[w + 0.04, 0.03, t + 0.02]} />
      </mesh>
      <mesh position={[0, depth / 2, h / 2]} material={m.metal}>
        <boxGeometry args={[w + 0.04, 0.03, t + 0.02]} />
      </mesh>
    </group>
  );
}

/** Box-truss boom, used to stand instruments and dishes off the bus. */
export function Truss({ m, length = 1, bays = 4, w = 0.14 }: { m: SpacecraftMaterials; length?: number; bays?: number; w?: number }) {
  const r = 0.016;
  const bay = length / bays;
  return (
    <group>
      {[
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ].map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} position={[(sx * w) / 2, length / 2, (sz * w) / 2]} material={m.metal}>
          <cylinderGeometry args={[r, r, length, 5]} />
        </mesh>
      ))}
      {Array.from({ length: bays + 1 }, (_, i) => (
        <group key={i} position={[0, i * bay, 0]}>
          {[-1, 1].map((s) => (
            <mesh key={`z${s}`} position={[0, 0, (s * w) / 2]} rotation={[0, 0, Math.PI / 2]} material={m.darkMetal}>
              <cylinderGeometry args={[r * 0.8, r * 0.8, w, 5]} />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={`x${s}`} position={[(s * w) / 2, 0, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.darkMetal}>
              <cylinderGeometry args={[r * 0.8, r * 0.8, w, 5]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
