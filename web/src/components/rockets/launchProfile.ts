// Derives a plausible ascent-to-orbit profile for a launch vehicle from its
// real specs. Not a trajectory simulator — it's a readable dramatisation whose
// milestones, timings and shapes match how orbital launches actually go, so the
// animation teaches the sequence rather than inventing one.
//
// Reference points (Falcon 9 to LEO): tower clear ~T+7s, Max Q ~T+72s,
// MECO ~T+2:32, stage sep ~T+2:36, fairing ~T+3:20, booster landing ~T+8:30,
// SECO ~T+8:45, orbital velocity ~7.8 km/s at ~200 km.

import type { RocketConfig } from "./rocketConfig";

export type EventKind =
  | "ignition"
  | "liftoff"
  | "maxq"
  | "boostersep"
  | "meco"
  | "stagesep"
  | "fairing"
  | "landing"
  | "seco";

export interface LaunchEvent {
  t: number; // seconds after liftoff
  kind: EventKind;
  label: string;
  detail: string;
}

export interface LaunchProfile {
  duration: number; // total animation seconds
  events: LaunchEvent[];
  targetAltKm: number;
  targetVelKms: number;
  hasBoosters: boolean;
  boosterSepT: number;
  stageSepT: number;
  fairingT: number | null; // null for crewed capsules (no fairing to jettison)
  landingT: number | null; // null when the booster is expended
  suborbital: boolean;
}

function n(v: unknown, fallback: number): number {
  const x = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(x) && (x as number) > 0 ? (x as number) : fallback;
}

export function deriveProfile(
  cfg: RocketConfig,
  opts: { reusable?: boolean | null; payloadLeoKg?: number | string | null; name?: string },
): LaunchProfile {
  const heavy = n(opts.payloadLeoKg, 0) > 15000 || cfg.height > 80;
  // Suborbital vehicles never reach orbital velocity — don't pretend they do.
  const suborbital = /new\s*shepard|blue\s*origin\s*ns|sounding/i.test(opts.name ?? "");

  const hasBoosters = cfg.boosters > 0;
  // Heavier vehicles burn their first stage longer.
  const stageSepT = suborbital ? 60 : heavy ? 168 : 150;
  const boosterSepT = hasBoosters ? Math.round(stageSepT * 0.82) : stageSepT;
  const fairingT = cfg.fairing === "capsule" ? null : Math.round(stageSepT + 45);
  const landingT = opts.reusable && !suborbital ? Math.round(stageSepT + 330) : null;
  const secoT = suborbital ? 140 : heavy ? 540 : 505;

  const duration = Math.max(secoT, landingT ?? 0) + 15;

  const events: LaunchEvent[] = [
    { t: -6, kind: "ignition", label: "Ignition", detail: `${cfg.engines} engine${cfg.engines > 1 ? "s" : ""} light; hold-down clamps release at T-0` },
    { t: 0, kind: "liftoff", label: "Liftoff", detail: "Thrust exceeds weight — the vehicle clears the tower" },
    { t: 72, kind: "maxq", label: "Max Q", detail: "Peak aerodynamic pressure; engines throttle down briefly" },
  ];

  if (hasBoosters) {
    events.push({
      t: boosterSepT,
      kind: "boostersep",
      label: "Booster separation",
      detail: `${cfg.boosters} ${cfg.boosterKind === "srb" ? "solid rocket booster" : "strap-on booster"}${cfg.boosters > 1 ? "s" : ""} burn out and fall away`,
    });
  }

  events.push(
    { t: stageSepT - 4, kind: "meco", label: "MECO", detail: "Main engine cutoff — first stage has done its job" },
    { t: stageSepT, kind: "stagesep", label: "Stage separation", detail: cfg.stages > 1 ? "Second stage ignites and continues to orbit" : "Upper section continues" },
  );

  if (fairingT !== null) {
    events.push({ t: fairingT, kind: "fairing", label: "Fairing jettison", detail: "Above the atmosphere the payload shroud is no longer needed" });
  }
  if (landingT !== null) {
    events.push({ t: landingT, kind: "landing", label: "Booster landing", detail: "The first stage flies back and lands for reuse" });
  }

  events.push({
    t: secoT,
    kind: "seco",
    label: suborbital ? "Apogee" : "Orbital insertion",
    detail: suborbital ? "Peak altitude reached; the vehicle falls back" : "Second engine cutoff — payload is in orbit",
  });

  return {
    duration,
    events: events.sort((a, b) => a.t - b.t),
    targetAltKm: suborbital ? 105 : 200,
    targetVelKms: suborbital ? 1.1 : 7.8,
    hasBoosters,
    boosterSepT,
    stageSepT,
    fairingT,
    landingT,
    suborbital,
  };
}

// Altitude (km) at time t. Slow off the pad, then a fast climb that eases into
// the target as the trajectory goes horizontal.
export function altitudeAt(t: number, p: LaunchProfile): number {
  if (t <= 0) return 0;
  const f = Math.min(1, t / p.duration);
  // ease-out cubic against a small quadratic kick at the start
  const climb = 1 - Math.pow(1 - f, 3);
  const initial = Math.min(1, (t / 12) ** 2);
  return p.targetAltKm * climb * (0.25 + 0.75 * initial);
}

// Speed (km/s). Builds through first-stage flight, dips at staging, then
// accelerates hard in vacuum — the real shape of a launch velocity plot.
export function velocityAt(t: number, p: LaunchProfile): number {
  if (t <= 0) return 0;
  const sep = p.stageSepT;
  if (t < sep) {
    const f = t / sep;
    return p.targetVelKms * 0.30 * (f * f);
  }
  if (t < sep + 6) return p.targetVelKms * 0.30 * 0.97; // brief coast at staging
  const f = Math.min(1, (t - sep) / (p.duration - sep));
  return p.targetVelKms * (0.30 + 0.70 * Math.pow(f, 0.75));
}

// The most recent event at time t (for the caption/HUD).
export function currentEvent(t: number, p: LaunchProfile): LaunchEvent | null {
  let cur: LaunchEvent | null = null;
  for (const e of p.events) if (t >= e.t) cur = e;
  return cur;
}

export function formatT(t: number): string {
  const sign = t < 0 ? "-" : "+";
  const a = Math.abs(t);
  const m = Math.floor(a / 60);
  const s = Math.floor(a % 60);
  return `T${sign}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
