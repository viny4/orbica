"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import * as THREE from "three";

// Celestial backdrop for Sky View: the brightest stars, a handful of
// constellation stick figures, and the classical planets. All positions are
// derived from catalogued RA/Dec (stars) or a low-precision Keplerian model
// (planets) and projected onto a large celestial sphere.

const DEG = Math.PI / 180;

// RA (hours) + Dec (degrees) → direction on a sphere, using the same axis
// convention as the globe so it lines up with the equatorial frame.
function radecToVec(raHours: number, decDeg: number, radius: number): [number, number, number] {
  const phi = (90 - decDeg) * DEG;
  const theta = (raHours * 15 + 180) * DEG;
  return [
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

// name, RA hours, Dec degrees, visual magnitude, spectral tint
const STARS: [string, number, number, number, string][] = [
  ["Sirius", 6.7525, -16.716, -1.46, "#cfe2ff"],
  ["Canopus", 6.399, -52.696, -0.74, "#fff4e8"],
  ["Alpha Cen", 14.660, -60.835, -0.27, "#ffe9c7"],
  ["Arcturus", 14.261, 19.182, -0.05, "#ffcf87"],
  ["Vega", 18.615, 38.784, 0.03, "#cfe0ff"],
  ["Capella", 5.278, 45.998, 0.08, "#fff0c2"],
  ["Rigel", 5.242, -8.202, 0.13, "#cfe0ff"],
  ["Procyon", 7.655, 5.225, 0.34, "#f2f6ff"],
  ["Achernar", 1.629, -57.237, 0.46, "#cfe0ff"],
  ["Betelgeuse", 5.919, 7.407, 0.50, "#ff9c6b"],
  ["Hadar", 14.064, -60.373, 0.61, "#cfe0ff"],
  ["Altair", 19.846, 8.868, 0.77, "#f2f6ff"],
  ["Aldebaran", 4.599, 16.509, 0.85, "#ffb36b"],
  ["Antares", 16.490, -26.432, 1.09, "#ff7a52"],
  ["Spica", 13.420, -11.161, 1.04, "#cfe0ff"],
  ["Pollux", 7.755, 28.026, 1.14, "#ffce87"],
  ["Fomalhaut", 22.961, -29.622, 1.16, "#f2f6ff"],
  ["Deneb", 20.690, 45.280, 1.25, "#dfe9ff"],
  ["Mimosa", 12.795, -59.689, 1.25, "#cfe0ff"],
  ["Regulus", 10.139, 11.967, 1.35, "#dfe9ff"],
  ["Adhara", 6.977, -28.972, 1.50, "#cfe0ff"],
  ["Castor", 7.577, 31.888, 1.58, "#dfe9ff"],
  ["Gacrux", 12.519, -57.113, 1.59, "#ff9c6b"],
  ["Shaula", 17.560, -37.104, 1.62, "#cfe0ff"],
  ["Bellatrix", 5.418, 6.350, 1.64, "#cfe0ff"],
  ["Elnath", 5.438, 28.608, 1.65, "#dfe9ff"],
  ["Miaplacidus", 9.220, -69.717, 1.67, "#f2f6ff"],
  ["Alnilam", 5.604, -1.202, 1.69, "#cfe0ff"],
  ["Alnair", 22.137, -46.961, 1.74, "#cfe0ff"],
  ["Alnitak", 5.679, -1.943, 1.74, "#cfe0ff"],
  ["Alioth", 12.900, 55.960, 1.77, "#dfe9ff"],
  ["Dubhe", 11.062, 61.751, 1.79, "#ffce87"],
  ["Mirfak", 3.405, 49.861, 1.79, "#fff0c2"],
  ["Wezen", 7.140, -26.393, 1.83, "#fff0c2"],
  ["Sargas", 17.622, -42.998, 1.86, "#fff0c2"],
  ["Kaus Austr", 18.403, -34.385, 1.85, "#dfe9ff"],
  ["Avior", 8.375, -59.510, 1.86, "#ffce87"],
  ["Alkaid", 13.792, 49.313, 1.86, "#cfe0ff"],
  ["Menkalinan", 5.992, 44.947, 1.90, "#dfe9ff"],
  ["Atria", 16.811, -69.028, 1.91, "#ff9c6b"],
  ["Alhena", 6.629, 16.399, 1.93, "#dfe9ff"],
  ["Peacock", 20.427, -56.735, 1.94, "#cfe0ff"],
  ["Polaris", 2.530, 89.264, 1.98, "#fff4e8"],
  ["Mirzam", 6.378, -17.956, 1.98, "#cfe0ff"],
  ["Alphard", 9.460, -8.659, 1.98, "#ffb36b"],
  ["Hamal", 2.120, 23.463, 2.00, "#ffce87"],
  ["Diphda", 0.726, -17.986, 2.04, "#ffce87"],
  ["Mizar", 13.399, 54.925, 2.23, "#dfe9ff"],
  ["Nunki", 18.921, -26.297, 2.05, "#cfe0ff"],
  ["Menkent", 14.111, -36.370, 2.06, "#ffce87"],
  ["Mirach", 1.162, 35.620, 2.05, "#ff9c6b"],
  ["Alpheratz", 0.140, 29.091, 2.06, "#cfe0ff"],
  ["Rasalhague", 17.582, 12.560, 2.08, "#f2f6ff"],
  ["Kochab", 14.845, 74.156, 2.07, "#ffb36b"],
  ["Saiph", 5.796, -9.670, 2.06, "#cfe0ff"],
  ["Denebola", 11.818, 14.572, 2.14, "#f2f6ff"],
  ["Algol", 3.136, 40.956, 2.12, "#cfe0ff"],
  ["Merak", 11.031, 56.382, 2.37, "#dfe9ff"],
  ["Phecda", 11.897, 53.695, 2.44, "#dfe9ff"],
  ["Megrez", 12.257, 57.033, 3.31, "#dfe9ff"],
  ["Ruchbah", 1.430, 60.235, 2.68, "#dfe9ff"],
  ["Segin", 1.906, 63.670, 3.35, "#cfe0ff"],
  ["Acrux", 12.443, -63.099, 0.77, "#cfe0ff"],
  ["Imai", 12.252, -58.749, 2.79, "#cfe0ff"],
];

const STAR_BY_NAME = new Map(STARS.map(([n, ra, dec]) => [n, { ra, dec }]));

// Constellation stick figures by star name.
const CONSTELLATIONS: { name: string; lines: [string, string][] }[] = [
  {
    name: "Orion",
    lines: [
      ["Betelgeuse", "Bellatrix"],
      ["Betelgeuse", "Alnitak"],
      ["Bellatrix", "Alnilam"],
      ["Alnitak", "Alnilam"],
      ["Alnilam", "Mintaka"],
      ["Alnitak", "Saiph"],
      ["Mintaka", "Rigel"],
      ["Saiph", "Rigel"],
    ],
  },
  {
    name: "Ursa Major",
    lines: [
      ["Dubhe", "Merak"],
      ["Merak", "Phecda"],
      ["Phecda", "Megrez"],
      ["Megrez", "Alioth"],
      ["Alioth", "Mizar"],
      ["Mizar", "Alkaid"],
    ],
  },
  {
    name: "Cassiopeia",
    lines: [
      ["Caph", "Schedar"],
      ["Schedar", "Ruchbah"],
      ["Ruchbah", "Segin"],
    ],
  },
  {
    name: "Crux",
    lines: [
      ["Acrux", "Gacrux"],
      ["Mimosa", "Imai"],
    ],
  },
];

// A few extra stars that only appear as constellation vertices.
const EXTRA = new Map<string, { ra: number; dec: number }>([
  ["Caph", { ra: 0.153, dec: 59.150 }],
  ["Schedar", { ra: 0.675, dec: 56.537 }],
  ["Mintaka", { ra: 5.533, dec: -0.299 }],
]);

const starPos = (name: string, radius: number) => {
  const s = STAR_BY_NAME.get(name) ?? EXTRA.get(name);
  return s ? radecToVec(s.ra, s.dec, radius) : null;
};

// ── Planets (low-precision Keplerian model, JPL mean elements) ────────────────

interface Elements { a: number; e: number; i: number; L: number; w: number; O: number; }

const PLANETS: { name: string; color: string; mag: number; el: Elements; rate: Elements }[] = [
  { name: "Mercury", color: "#cbbfae", mag: -0.4,
    el: { a: 0.38709927, e: 0.20563593, i: 7.00497902, L: 252.25032350, w: 77.45779628, O: 48.33076593 },
    rate: { a: 0.00000037, e: 0.00001906, i: -0.00594749, L: 149472.67411175, w: 0.16047689, O: -0.12534081 } },
  { name: "Venus", color: "#f5e6c8", mag: -4.4,
    el: { a: 0.72333566, e: 0.00677672, i: 3.39467605, L: 181.97909950, w: 131.60246718, O: 76.67984255 },
    rate: { a: 0.00000390, e: -0.00004107, i: -0.00078890, L: 58517.81538729, w: 0.00268329, O: -0.27769418 } },
  { name: "Mars", color: "#e8834f", mag: -1.6,
    el: { a: 1.52371034, e: 0.09339410, i: 1.84969142, L: -4.55343205, w: -23.94362959, O: 49.55953891 },
    rate: { a: 0.00001847, e: 0.00007882, i: -0.00813131, L: 19140.30268499, w: 0.44441088, O: -0.29257343 } },
  { name: "Jupiter", color: "#e8d5a8", mag: -2.4,
    el: { a: 5.20288700, e: 0.04838624, i: 1.30439695, L: 34.39644051, w: 14.72847983, O: 100.47390909 },
    rate: { a: -0.00011607, e: -0.00013253, i: -0.00183714, L: 3034.74612775, w: 0.21252668, O: 0.20469106 } },
  { name: "Saturn", color: "#e6d08a", mag: 0.5,
    el: { a: 9.53667594, e: 0.05386179, i: 2.48599187, L: 49.95424423, w: 92.59887831, O: 113.66242448 },
    rate: { a: -0.00125060, e: -0.00050991, i: 0.00193609, L: 1222.49362201, w: -0.41897216, O: -0.28867794 } },
];

const EARTH_EL: Elements = { a: 1.00000261, e: 0.01671123, i: -0.00001531, L: 100.46457166, w: 102.93768193, O: 0 };
const EARTH_RATE: Elements = { a: 0.00000562, e: -0.00004392, i: -0.01294668, L: 35999.37244981, w: 0.32327364, O: 0 };

const norm360 = (d: number) => ((d % 360) + 360) % 360;

// Solve Kepler's equation M = E - e·sin E for eccentric anomaly E.
function kepler(M: number, e: number): number {
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  for (let i = 0; i < 8; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-9) break;
  }
  return E;
}

// Heliocentric ecliptic rectangular coordinates (AU).
function heliocentric(el: Elements, T: number, rate: Elements): [number, number, number] {
  const a = el.a + rate.a * T;
  const e = el.e + rate.e * T;
  const inc = (el.i + rate.i * T) * DEG;
  const L = el.L + rate.L * T;
  const wbar = el.w + rate.w * T;
  const O = (el.O + rate.O * T) * DEG;
  const w = wbar * DEG - O;
  const M = norm360(L - wbar) * DEG;
  const E = kepler(M, e);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  // Rotate into the ecliptic frame.
  const cw = Math.cos(w), sw = Math.sin(w);
  const cO = Math.cos(O), sO = Math.sin(O);
  const ci = Math.cos(inc), si = Math.sin(inc);
  const x = (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp;
  const y = (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp;
  const z = (sw * si) * xp + (cw * si) * yp;
  return [x, y, z];
}

// Geocentric RA (hours) / Dec (degrees) of a planet at a given time.
function planetRaDec(el: Elements, rate: Elements, T: number): { ra: number; dec: number } {
  const p = heliocentric(el, T, rate);
  const E = heliocentric(EARTH_EL, T, EARTH_RATE);
  const gx = p[0] - E[0];
  const gy = p[1] - E[1];
  const gz = p[2] - E[2];
  const eps = 23.43928 * DEG;
  // Ecliptic → equatorial.
  const xe = gx;
  const ye = gy * Math.cos(eps) - gz * Math.sin(eps);
  const ze = gy * Math.sin(eps) + gz * Math.cos(eps);
  const ra = norm360(Math.atan2(ye, xe) / DEG) / 15;
  const dec = Math.asin(ze / Math.hypot(xe, ye, ze)) / DEG;
  return { ra, dec };
}

// ── Components ────────────────────────────────────────────────────────────────

// Round star sprite with a soft halo, sized per-star by visual magnitude.
// A shader gives us per-point sizes (pointsMaterial only has one) and avoids
// the blocky square sprites a plain PointsMaterial produces.
const STAR_VERT = `
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize;
    gl_Position = projectionMatrix * mv;
  }
`;
const STAR_FRAG = `
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float alpha = smoothstep(0.5, 0.02, d);
    alpha = pow(alpha, 1.1);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor * 2.0, alpha);
  }
`;

function StarField({ radius, showLabels }: { radius: number; showLabels: boolean }) {
  const { camera } = useThree();
  const labelsRef = useRef<THREE.Group>(null);

  const { positions, colors, sizes } = useMemo(() => {
    const pos = new Float32Array(STARS.length * 3);
    const col = new Float32Array(STARS.length * 3);
    const size = new Float32Array(STARS.length);
    const c = new THREE.Color();
    STARS.forEach(([, ra, dec, mag, color], i) => {
      const [x, y, z] = radecToVec(ra, dec, radius);
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      // Brighter (lower magnitude) stars get bigger halos.
      size[i] = Math.max(3, Math.min(16, (3.0 - mag) * 2.0 + 3));
      c.set(color).multiplyScalar(Math.max(0.7, Math.min(1.7, (3.2 - mag) / 2.2)));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    });
    return { positions: pos, colors: col, sizes: size };
  }, [radius]);

  // Hide magnitude labels when the camera is far, to avoid clutter.
  useFrame(() => {
    if (labelsRef.current) {
      labelsRef.current.visible = showLabels && camera.position.length() < 3;
    }
  });

  return (
    <group>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-aColor" args={[colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={STAR_VERT}
          fragmentShader={STAR_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      {showLabels && (
        <group ref={labelsRef}>
          {STARS.filter(([, , , mag]) => mag < 1.3).map(([name, ra, dec]) => (
            <Html key={name} position={radecToVec(ra, dec, radius * 0.995)} center>
              <div className="pointer-events-none select-none whitespace-nowrap rounded-sm border border-white/10 bg-black/70 px-1 py-px font-mono text-[8px] uppercase tracking-widest text-white/70">
                {name}
              </div>
            </Html>
          ))}
        </group>
      )}
    </group>
  );
}

function ConstellationLines({ radius, showLabels }: { radius: number; showLabels: boolean }) {
  const { camera } = useThree();
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = showLabels && camera.position.length() < 3;
  });

  const figures = useMemo(
    () =>
      CONSTELLATIONS.map((c) => ({
        name: c.name,
        namePos: starPos(c.lines[0][0], radius * 0.985),
        lines: c.lines
          .map(([a, b]) => ({ a: starPos(a, radius), b: starPos(b, radius) }))
          .filter((l): l is { a: [number, number, number]; b: [number, number, number] } => !!l.a && !!l.b),
      })),
    [radius],
  );

  return (
    <group ref={ref}>
      {figures.map((fig) => (
        <group key={fig.name}>
          {fig.lines.map((l, i) => (
            <Line
              key={i}
              points={[l.a, l.b]}
              color="#5b8cff"
              lineWidth={1}
              transparent
              opacity={0.22}
              depthWrite={false}
            />
          ))}
          {fig.namePos && (
            <Html position={fig.namePos} center>
              <div className="pointer-events-none select-none whitespace-nowrap font-mono text-[7px] uppercase tracking-[0.3em] text-accent/50">
                {fig.name}
              </div>
            </Html>
          )}
        </group>
      ))}
    </group>
  );
}

function Planets({ radius, showLabels, when }: { radius: number; showLabels: boolean; when: Date }) {
  const { camera } = useThree();
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = showLabels && camera.position.length() < 3;
  });

  const bodies = useMemo(() => {
    const jd = when.getTime() / 86400000 + 2440587.5;
    const T = (jd - 2451545.0) / 36525;
    return PLANETS.map((p) => {
      const { ra, dec } = planetRaDec(p.el, p.rate, T);
      return { ...p, pos: radecToVec(ra, dec, radius * 0.99), size: Math.max(0.012, (2.6 - p.mag) * 0.006) };
    });
  }, [radius, when]);

  return (
    <group ref={ref}>
      {bodies.map((b) => (
        <group key={b.name}>
          <mesh position={b.pos}>
            <sphereGeometry args={[b.size, 12, 12]} />
            <meshBasicMaterial color={b.color} />
          </mesh>
          <Html position={b.pos} center>
            <div className="pointer-events-none mt-4 select-none whitespace-nowrap font-mono text-[7px] uppercase tracking-[0.25em]" style={{ color: b.color }}>
              {b.name}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

export function SkyObjects({ showLabels = true, when }: { showLabels?: boolean; when: Date }) {
  const radius = 90;
  return (
    <group>
      <StarField radius={radius} showLabels={showLabels} />
      <ConstellationLines radius={radius} showLabels={showLabels} />
      <Planets radius={radius} showLabels={showLabels} when={when} />
    </group>
  );
}
