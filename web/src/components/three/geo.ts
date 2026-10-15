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

// ── tiny vector helpers (keeps this module free of a THREE dependency) ─────────
type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.sqrt(dot(a, a));
const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dist = (a: V3, b: V3) => len(sub(a, b));

// Extended orbital elements for detailed display
export interface OrbitalElements {
  semiMajorAxis: number;      // km
  eccentricity: number;
  inclination: number;        // degrees
  raan: number;               // degrees (Right Ascension of Ascending Node)
  argPerigee: number;         // degrees (Argument of Perigee)
  meanAnomaly: number;        // degrees
  meanMotion: number;         // rev/day
  period: number;             // minutes
  perigee: number;            // km altitude
  apogee: number;             // km altitude
  epoch: Date;
}

// TLE epoch (columns 19-32 of line 1: YYDDD.DDDDDDDD) → Date.
function tleEpoch(line1: string): Date {
  const yy = parseInt(line1.substring(18, 20), 10);
  const doy = parseFloat(line1.substring(20, 32));
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  return new Date(Date.UTC(year, 0, 1) + (doy - 1) * 86400000);
}

// Extract full orbital elements from a TLE.
export function getOrbitalElements(line1: string, line2: string): OrbitalElements | null {
  try {
    const satrec = satrecFor(line1, line2);

    // Mean motion in rev/day
    const meanMotion = (satrec.no * 60 * 24) / (2 * Math.PI);

    // Semi-major axis from mean motion (Kepler's 3rd law: n = sqrt(mu / a^3))
    const mu = 398600.4418; // Earth gravitational parameter km^3/s^2
    const n = (meanMotion * 2 * Math.PI) / 86400; // rad/s
    const semiMajorAxis = Math.pow(mu / (n * n), 1 / 3);

    const eccentricity = satrec.ecco;
    // RAAN / argp / mean anomaly are radians in [0, 2π) — convert directly,
    // since satellite.js's degreesLong() rejects anything outside [-π, π].
    const toDeg = (rad: number) => (((rad * 180) / Math.PI) % 360 + 360) % 360;
    const inclination = (satrec.inclo * 180) / Math.PI;
    const raan = toDeg(satrec.nodeo);
    const argPerigee = toDeg(satrec.argpo);
    const meanAnomaly = toDeg(satrec.mo);

    const perigee = semiMajorAxis * (1 - eccentricity) - EARTH_KM;
    const apogee = semiMajorAxis * (1 + eccentricity) - EARTH_KM;
    const period = meanMotion > 0 ? 1440 / meanMotion : 0;

    return {
      semiMajorAxis,
      eccentricity,
      inclination,
      raan,
      argPerigee,
      meanAnomaly,
      meanMotion,
      period,
      perigee,
      apogee,
      epoch: tleEpoch(line1),
    };
  } catch {
    return null;
  }
}

// Check if the satellite is in Earth's shadow (umbra, cylindrical model).
export function isInEclipse(line1: string, line2: string, when: Date): boolean {
  const pos = propagateTLE(line1, line2, when);
  if (!pos) return false;

  const sunDir = norm(sunDirection(when));
  const rSat = norm(latLngAltToVec3(pos.lat, pos.lng, pos.altKm));

  // Angle between satellite and Sun as seen from Earth's centre.
  const angle = Math.acos(Math.max(-1, Math.min(1, dot(rSat, sunDir))));

  // Angular radius of Earth as seen from the satellite.
  const earthAngularRadius = Math.asin(EARTH_KM / (EARTH_KM + pos.altKm));

  return angle > Math.PI / 2 + earthAngularRadius;
}

// Doppler shift of a signal from the satellite as seen at a ground station.
export function calculateDopplerShift(
  line1: string,
  line2: string,
  when: Date,
  groundLat: number,
  groundLng: number,
  frequencyHz: number = 437e6, // default 70 cm amateur band
): { shiftHz: number; shiftKHz: number; approaching: boolean } | null {
  const satPos = propagateTLE(line1, line2, when);
  if (!satPos) return null;

  const satVec = latLngAltToVec3(satPos.lat, satPos.lng, satPos.altKm);
  const groundVec = latLngAltToVec3(groundLat, groundLng, 0);

  const satrec = satrecFor(line1, line2);
  const pv = satellite.propagate(satrec, when);
  if (!pv || typeof pv.position === "boolean" || !pv.velocity || typeof pv.velocity === "boolean") return null;

  // Rotate the ECI velocity into the Earth-fixed frame using GMST.
  const gmst = satellite.gstime(when);
  const cosG = Math.cos(gmst);
  const sinG = Math.sin(gmst);
  const velEcef: V3 = [
    pv.velocity.x * cosG - pv.velocity.y * sinG,
    pv.velocity.x * sinG + pv.velocity.y * cosG,
    pv.velocity.z,
  ];

  const los = norm(sub(satVec, groundVec));
  const radialVel = dot(velEcef, los); // km/s, positive = receding

  const c = 299792.458; // km/s
  const shiftHz = (-radialVel / c) * frequencyHz;

  return { shiftHz, shiftKHz: shiftHz / 1000, approaching: radialVel < 0 };
}

// A single overhead pass of a satellite for a ground station.
export interface PassInfo {
  aos: Date;           // Acquisition of Signal
  los: Date;           // Loss of Signal
  maxElevation: number;
  maxElevationTime: Date;
  duration: number;    // seconds
  azimuthAtAos: number;
  azimuthAtLos: number;
}

export function getFuturePasses(
  line1: string,
  line2: string,
  groundLat: number,
  groundLng: number,
  hoursAhead: number = 24,
  minElevation: number = 10,
): PassInfo[] {
  const passes: PassInfo[] = [];
  const now = Date.now();
  const endTime = now + hoursAhead * 3600 * 1000;
  const stepMs = 30000; // 30 second steps

  let inPass = false;
  let passStart = 0;
  let maxEl = 0;
  let maxElTime = 0;
  let azAtAos = 0;

  for (let t = now; t <= endTime; t += stepMs) {
    const p = propagateTLE(line1, line2, new Date(t));
    if (!p) continue;

    const elevation = getElevation(groundLat, groundLng, p.lat, p.lng, p.altKm);
    const azimuth = getBearing(groundLat, groundLng, p.lat, p.lng);

    if (elevation >= minElevation) {
      if (!inPass) {
        inPass = true;
        passStart = t;
        maxEl = elevation;
        maxElTime = t;
        azAtAos = azimuth;
      }
      if (elevation > maxEl) {
        maxEl = elevation;
        maxElTime = t;
      }
    } else if (inPass) {
      inPass = false;
      const duration = t - passStart;
      if (duration >= 60000) {
        passes.push({
          aos: new Date(passStart),
          los: new Date(t),
          maxElevation: maxEl,
          maxElevationTime: new Date(maxElTime),
          duration: duration / 1000,
          azimuthAtAos: azAtAos,
          azimuthAtLos: azimuth,
        });
      }
    }
  }

  return passes;
}

// Elevation (degrees above the horizon) of a satellite from a ground station.
export function getElevation(
  groundLat: number,
  groundLng: number,
  satLat: number,
  satLng: number,
  satAlt: number,
): number {
  const userVec = latLngAltToVec3(groundLat, groundLng, 0);
  const satVec = latLngAltToVec3(satLat, satLng, satAlt);
  const up = norm(userVec);
  const rel = norm(sub(satVec, userVec));
  const cosTheta = Math.max(-1, Math.min(1, dot(up, rel)));
  return (Math.acos(cosTheta) * -180) / Math.PI + 90;
}

// Compass bearing (degrees from north) from a ground station to a satellite.
export function getBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLon = (lng2 - lng1) * (Math.PI / 180);
  const l1 = lat1 * (Math.PI / 180);
  const l2 = lat2 * (Math.PI / 180);
  const y = Math.sin(dLon) * Math.cos(l2);
  const x = Math.cos(l1) * Math.sin(l2) - Math.sin(l1) * Math.cos(l2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Sun direction as an ECEF-ish vector (scaled to the scene's far star shell).
export function sunDirection(now: Date): V3 {
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const doy = Math.floor((now.getTime() - start) / 86400000);
  const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (doy + 10));
  const utc = now.getUTCHours() + now.getUTCMinutes() / 60;
  const lng = -15 * (utc - 12);
  const [x, y, z] = latLngAltToVec3(decl, lng, 0);
  return [x * 60, y * 60, z * 60];
}

// An orbit sample point that also carries whether the satellite is in shadow.
export interface OrbitPoint {
  position: Vec3;
  inShadow: boolean;
  lat: number;
  lng: number;
  altKm: number;
}

export function orbitPathWithShadow(
  line1: string,
  line2: string,
  samples = 360,
  when?: Date,
): OrbitPoint[] {
  const satrec = satrecFor(line1, line2);
  const revsPerDay = (satrec.no * 60 * 24) / (2 * Math.PI);
  const periodMin = revsPerDay > 0 ? 1440 / revsPerDay : 92;
  const baseTime = when || new Date();
  const pts: OrbitPoint[] = [];

  for (let i = 0; i <= samples; i++) {
    const t = new Date(baseTime.getTime() + (periodMin * 60 * 1000 * i) / samples);
    const p = propagateTLE(line1, line2, t);
    if (p) {
      pts.push({
        position: latLngAltToVec3(p.lat, p.lng, p.altKm),
        inShadow: isInEclipse(line1, line2, t),
        lat: p.lat,
        lng: p.lng,
        altKm: p.altKm,
      });
    }
  }
  return pts;
}

// A close approach between two satellites.
export interface ConjunctionInfo {
  time: Date;
  sat1Pos: GeoPos;
  sat2Pos: GeoPos;
  missDistance: number;  // km
  relativeSpeed: number; // km/s
  probability: number;   // 0-1 rough estimate
}

export function checkConjunction(
  line1a: string, line2a: string,
  line1b: string, line2b: string,
  hoursAhead: number = 24,
  thresholdKm: number = 10,
): ConjunctionInfo[] {
  const conjunctions: ConjunctionInfo[] = [];
  const now = Date.now();
  const endTime = now + hoursAhead * 3600 * 1000;
  const stepMs = 60000; // 1 minute steps

  for (let t = now; t <= endTime; t += stepMs) {
    const time = new Date(t);
    const p1 = propagateTLE(line1a, line2a, time);
    const p2 = propagateTLE(line1b, line2b, time);
    if (!p1 || !p2) continue;

    const v1 = latLngAltToVec3(p1.lat, p1.lng, p1.altKm);
    const v2 = latLngAltToVec3(p2.lat, p2.lng, p2.altKm);
    const distance = dist(v1, v2) * (EARTH_KM / EARTH_R);

    if (distance < thresholdKm) {
      const satrec1 = satrecFor(line1a, line2a);
      const satrec2 = satrecFor(line1b, line2b);
      const pv1 = satellite.propagate(satrec1, time);
      const pv2 = satellite.propagate(satrec2, time);

      let relSpeed = 0;
      if (pv1 && typeof pv1.velocity !== "boolean" && pv2 && typeof pv2.velocity !== "boolean") {
        relSpeed = Math.hypot(
          pv1.velocity.x - pv2.velocity.x,
          pv1.velocity.y - pv2.velocity.y,
          pv1.velocity.z - pv2.velocity.z,
        );
      }

      conjunctions.push({
        time,
        sat1Pos: p1,
        sat2Pos: p2,
        missDistance: distance,
        relativeSpeed: relSpeed,
        probability: Math.max(0, 1 - distance / thresholdKm),
      });
    }
  }

  return conjunctions;
}

// Format orbital elements for display.
export function formatOrbitalElements(elements: OrbitalElements): Record<string, string> {
  return {
    "Semi-major Axis": `${elements.semiMajorAxis.toFixed(1)} km`,
    "Eccentricity": elements.eccentricity.toFixed(6),
    "Inclination": `${elements.inclination.toFixed(2)}°`,
    "RAAN": `${elements.raan.toFixed(2)}°`,
    "Arg. Perigee": `${elements.argPerigee.toFixed(2)}°`,
    "Mean Anomaly": `${elements.meanAnomaly.toFixed(2)}°`,
    "Mean Motion": `${elements.meanMotion.toFixed(4)} rev/day`,
    "Period": `${elements.period.toFixed(1)} min`,
    "Perigee": `${elements.perigee.toFixed(1)} km`,
    "Apogee": `${elements.apogee.toFixed(1)} km`,
    "Epoch": elements.epoch.toISOString().replace("T", " ").substring(0, 19) + " UTC",
  };
}
