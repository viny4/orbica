import * as satellite from "satellite.js";

// Scene units: Earth rendered at radius EARTH_R; 1 unit = EARTH_KM/EARTH_R km.
export const EARTH_R = 2;
export const EARTH_KM = 6371;
// Texture alignment nudge so continents sit under the right lat/lng.
export const EARTH_ROTATION_Y = -Math.PI / 2;

export type Vec3 = [number, number, number];

// Geodetic (deg, deg, km altitude) → scene cartesian on/above the globe.
export function latLngAltToVec3(latDeg: number, lngDeg: number, altKm = 0): Vec3 {
  const r = EARTH_R * (1 + altKm / EARTH_KM);
  const phi = (90 - latDeg) * (Math.PI / 180);
  const theta = (lngDeg + 180) * (Math.PI / 180);
  return [
    -(r * Math.sin(phi) * Math.cos(theta)),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ];
}

export interface GeoPos {
  lat: number;
  lng: number;
  altKm: number;
  speedKmS: number;
}

// twoline2satrec parses the element set AND runs SGP4 initialisation — the
// expensive part. Callers propagate the same TLE every frame (ride-along
// camera), 240× for an orbit path, or 1440× for a next-pass search, so parse
// once and reuse. Small LRU: only a handful of TLEs are ever live at once.
const SATREC_CACHE_MAX = 64;
const satrecs = new Map<string, satellite.SatRec>();

export function satrecFor(line1: string, line2: string): satellite.SatRec {
  const key = `${line1}\n${line2}`;
  let rec = satrecs.get(key);
  if (rec) {
    satrecs.delete(key); // refresh LRU position
  } else {
    rec = satellite.twoline2satrec(line1, line2);
    if (satrecs.size >= SATREC_CACHE_MAX) satrecs.delete(satrecs.keys().next().value as string);
  }
  satrecs.set(key, rec);
  return rec;
}

// Propagate a TLE to a given instant → geodetic position + speed.
export function propagateTLE(line1: string, line2: string, when: Date): GeoPos | null {
  try {
    const satrec = satrecFor(line1, line2);
    const pv = satellite.propagate(satrec, when);
    if (!pv || !pv.position || typeof pv.position === "boolean") return null;
    const gmst = satellite.gstime(when);
    const geo = satellite.eciToGeodetic(pv.position as satellite.EciVec3<number>, gmst);
    const v = pv.velocity as satellite.EciVec3<number>;
    const speed = v ? Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) : 0;
    return {
      lat: satellite.degreesLat(geo.latitude),
      lng: satellite.degreesLong(geo.longitude),
      altKm: geo.height,
      speedKmS: speed,
    };
  } catch {
    return null;
  }
}

// Sample one full orbit (~period) into a path of scene points.
export function orbitPath(line1: string, line2: string, samples = 180): Vec3[] {
  const satrec = satrecFor(line1, line2);
  // Mean motion (rev/day) → period in minutes.
  const revsPerDay = (satrec.no * 60 * 24) / (2 * Math.PI);
  const periodMin = revsPerDay > 0 ? 1440 / revsPerDay : 92;
  const now = Date.now();
  const pts: Vec3[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = new Date(now + (periodMin * 60 * 1000 * i) / samples);
    const p = propagateTLE(line1, line2, t);
    if (p) pts.push(latLngAltToVec3(p.lat, p.lng, p.altKm));
  }
  return pts;
}

// The ground track: the sub-satellite point traced on the Earth's surface over
// the next `minutes`. Same propagation as orbitPath but projected to ground
// level (a small lift avoids z-fighting with the globe texture). In 3D the
// antimeridian seam is a non-issue — consecutive points are physically adjacent.
export function groundTrack(line1: string, line2: string, minutes = 95, samples = 180): Vec3[] {
  const now = Date.now();
  const pts: Vec3[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = new Date(now + (minutes * 60 * 1000 * i) / samples);
    const p = propagateTLE(line1, line2, t);
    if (p) pts.push(latLngAltToVec3(p.lat, p.lng, 30));
  }
  return pts;
}
