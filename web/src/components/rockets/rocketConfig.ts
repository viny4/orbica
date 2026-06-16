// Derives a distinct, plausible 3D configuration for a rocket from its real
// specs + a curated table of famous families. The point: no two unrelated
// rockets look identical, and the iconic ones (Falcon Heavy, Soyuz, Shuttle…)
// are recognisably correct.

export interface RocketSpec {
  name: string;
  family?: string | null;
  height_m?: number | string | null;
  diameter_m?: number | string | null;
  stages?: number | string | null;
  thrust_kn?: number | string | null;
  reusable?: boolean | null;
  // Real first-stage engine count from the engine catalogue, when known —
  // far more accurate for the nozzle cluster than the thrust heuristic.
  engineCount?: number | null;
}

export type BoosterKind = "none" | "strapon" | "srb" | "core";
export type FairingKind = "fairing" | "capsule" | "shuttle";

export interface RocketConfig {
  height: number;
  diameter: number;
  stages: number;
  boosters: number;
  boosterKind: BoosterKind;
  fairing: FairingKind;
  engines: number;
  palette: { body: string; upper: string; booster: string; accent: string };
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) && (n as number) > 0 ? (n as number) : fallback;
}

interface FamilyRule {
  test: RegExp;
  boosters?: number;
  boosterKind?: BoosterKind;
  fairing?: FairingKind;
  engines?: number;
  palette?: Partial<RocketConfig["palette"]>;
}

// Curated, ordered most-specific-first. Palettes follow the real liveries.
const RULES: FamilyRule[] = [
  // SpaceX — white with black soot bands / interstage
  { test: /falcon\s*heavy/i, boosters: 2, boosterKind: "core", engines: 9, fairing: "fairing", palette: { body: "#f3f5f8", upper: "#e4e8ee", booster: "#eef1f6", accent: "#20242c" } },
  { test: /falcon\s*9/i, boosters: 0, boosterKind: "none", engines: 9, fairing: "fairing", palette: { body: "#f3f5f8", upper: "#e2e6ec", accent: "#20242c" } },
  { test: /falcon\s*1/i, boosters: 0, engines: 1, fairing: "fairing", palette: { body: "#eef1f5" } },
  // Starship — bare stainless steel
  { test: /starship|super\s*heavy/i, boosters: 0, engines: 33, fairing: "capsule", palette: { body: "#ccd2da", upper: "#bcc3cc", booster: "#c2c8d0", accent: "#7e858f" } },
  // Shuttle — orange external tank, white SRBs
  { test: /space\s*shuttle|sts/i, boosters: 2, boosterKind: "srb", fairing: "shuttle", engines: 3, palette: { body: "#cf6a2b", upper: "#cf6a2b", booster: "#ededed", accent: "#222222" } },
  // Soyuz family — light grey
  { test: /soyuz|molniya|voskhod|vostok/i, boosters: 4, boosterKind: "strapon", engines: 4, fairing: "fairing", palette: { body: "#b7bdc4", upper: "#cdd2d8", booster: "#aab0b8", accent: "#3a3f47" } },
  // Saturn V — white with black roll pattern
  { test: /saturn\s*v/i, boosters: 0, engines: 5, fairing: "capsule", palette: { body: "#f4f4f4", upper: "#ececec", booster: "#f0f0f0", accent: "#141414" } },
  { test: /saturn\s*1|saturn\s*ib/i, boosters: 0, engines: 8, fairing: "capsule", palette: { body: "#f0f0f0", accent: "#141414" } },
  // Ariane 5/6 — orange foam core, white SRBs
  { test: /ariane\s*5/i, boosters: 2, boosterKind: "srb", engines: 1, fairing: "fairing", palette: { body: "#d6a05a", upper: "#e8e4dc", booster: "#e7e3db", accent: "#5b4326" } },
  { test: /ariane\s*6/i, boosters: 2, boosterKind: "srb", engines: 1, fairing: "fairing", palette: { body: "#d6a05a", upper: "#e8e4dc", booster: "#e7e3db" } },
  { test: /ariane/i, boosters: 0, engines: 1, fairing: "fairing", palette: { body: "#e8e4dc" } },
  // Delta IV — orange cryogenic foam
  { test: /delta\s*iv\s*heavy/i, boosters: 2, boosterKind: "core", engines: 1, palette: { body: "#d97a2a", upper: "#e6e2da", booster: "#d97a2a", accent: "#5a3214" } },
  { test: /delta\s*iv/i, boosters: 2, boosterKind: "srb", engines: 1, palette: { body: "#d97a2a", upper: "#e6e2da", booster: "#ededed" } },
  { test: /delta/i, boosters: 0, engines: 1, palette: { body: "#e9ebef" } },
  // Atlas V — bronze/copper common-core booster
  { test: /atlas\s*v/i, boosters: 2, boosterKind: "srb", engines: 1, fairing: "fairing", palette: { body: "#b1722f", upper: "#e2e3e6", booster: "#ededed", accent: "#5a3a18" } },
  { test: /atlas/i, boosters: 0, engines: 1, fairing: "fairing", palette: { body: "#d8dce2" } },
  // Vulcan — white with red accents
  { test: /vulcan/i, boosters: 2, boosterKind: "srb", engines: 2, fairing: "fairing", palette: { body: "#eef1f5", upper: "#dfe3ea", booster: "#ededed", accent: "#b83227" } },
  // India — white with orange strap-ons
  { test: /pslv/i, boosters: 6, boosterKind: "srb", engines: 1, fairing: "fairing", palette: { body: "#eef0f2", booster: "#e6e8ea", accent: "#c9742a" } },
  { test: /gslv/i, boosters: 4, boosterKind: "strapon", engines: 1, fairing: "fairing", palette: { body: "#eef0f2", booster: "#e2e5e9" } },
  // China — white
  { test: /long\s*march\s*5/i, boosters: 4, boosterKind: "strapon", engines: 2, fairing: "fairing", palette: { body: "#eef1f4", booster: "#e3e7ec", accent: "#2f5aa0" } },
  { test: /long\s*march/i, boosters: 4, boosterKind: "strapon", engines: 1, fairing: "fairing", palette: { body: "#eaedf0", booster: "#dee2e7" } },
  // Proton — light grey
  { test: /proton/i, boosters: 6, boosterKind: "strapon", engines: 6, fairing: "fairing", palette: { body: "#d4dae2", booster: "#c6cdd6" } },
  // Japan — white with orange-tan SRBs
  { test: /h-?ii|h-?2|h3|h-?3/i, boosters: 2, boosterKind: "srb", engines: 1, fairing: "fairing", palette: { body: "#e9e9e9", booster: "#d9b27a", accent: "#b65b1f" } },
  // Electron — carbon-fibre black
  { test: /electron/i, boosters: 0, engines: 9, fairing: "fairing", palette: { body: "#232629", upper: "#2c3035", booster: "#1d2023", accent: "#000000" } },
  // New Glenn — dark navy
  { test: /new\s*glenn/i, boosters: 0, engines: 7, fairing: "fairing", palette: { body: "#1b1e25", upper: "#23262e", booster: "#1b1e25", accent: "#0b0d11" } },
  { test: /new\s*shepard/i, boosters: 0, engines: 1, fairing: "capsule", palette: { body: "#eceff4" } },
  { test: /titan/i, boosters: 2, boosterKind: "srb", engines: 2, fairing: "fairing", palette: { body: "#d8dce2", booster: "#ededed" } },
  { test: /zenit/i, boosters: 0, engines: 1, fairing: "fairing", palette: { body: "#cfd6de" } },
  // SLS — orange foam core + white SRBs (Shuttle-derived), carries Orion
  { test: /sls|space\s*launch\s*system/i, boosters: 2, boosterKind: "srb", engines: 4, fairing: "capsule", palette: { body: "#cf6a2b", upper: "#e6e2da", booster: "#ededed", accent: "#222222" } },
  // Europe — Vega: slender white solid stack
  { test: /vega/i, boosters: 0, engines: 1, fairing: "fairing", palette: { body: "#e8eaed", upper: "#dfe2e6", accent: "#39414b" } },
  // Antares — bare aluminium-grey first stage
  { test: /antares/i, boosters: 0, engines: 2, fairing: "fairing", palette: { body: "#cdd2d8", upper: "#dfe3e8", accent: "#2a3038" } },
  // Angara — light grey with bronze strap-ons
  { test: /angara/i, boosters: 4, boosterKind: "strapon", engines: 1, fairing: "fairing", palette: { body: "#cdd3da", booster: "#c2c8cf", accent: "#3a3f47" } },
  // Energia — orange foam core, lighter strap-ons (Soviet super-heavy)
  { test: /energia/i, boosters: 4, boosterKind: "strapon", engines: 4, fairing: "fairing", palette: { body: "#d97a2a", booster: "#e3ddd2", accent: "#5a3214" } },
  // Minotaur — military grey/white solid
  { test: /minotaur/i, boosters: 0, engines: 1, fairing: "fairing", palette: { body: "#d2d6dc", accent: "#333a42" } },
  // Epsilon — white with blue accents (Japan)
  { test: /epsilon/i, boosters: 0, engines: 1, fairing: "fairing", palette: { body: "#eef0f3", upper: "#e2e5e9", accent: "#1f5aa8" } },
  // Terran — carbon-composite black (Relativity)
  { test: /terran/i, boosters: 0, engines: 9, fairing: "fairing", palette: { body: "#1f2226", upper: "#272b30", accent: "#000000" } },
  // N1 — grey conical Soviet moon rocket
  { test: /\bn-?1\b/i, boosters: 0, engines: 6, fairing: "capsule", palette: { body: "#cdd2d8", upper: "#d8dce2", accent: "#3a3f47" } },
  // Older Soviet — grey
  { test: /kosmos|tsiklon|tsyklon|dnepr|rokot/i, boosters: 0, engines: 1, fairing: "fairing", palette: { body: "#9fa8bb" } },
];

// Atlas V / Delta variant numbers literally encode the booster count, so we can
// read it off the name instead of guessing. Returns -1 when not applicable.
function boostersFromVariant(hay: string): number {
  // Atlas V "NYZ": middle digit Y = number of solid rocket boosters (0–5).
  const av = hay.match(/atlas\s*v\s*n?(\d)(\d)(\d)/i);
  if (av) return parseInt(av[2], 10);
  // Delta II "7YZW"/"6YZW": second digit Y = number of GEM strap-ons (0,3,4,9…).
  const d2 = hay.match(/delta\s*(?:ii|2)\s*[6-7](\d)/i);
  if (d2) return parseInt(d2[1], 10);
  // Delta IV Medium+ "(5,4)"/"(4,2)": second number = SRBs.
  const d4 = hay.match(/delta\s*(?:iv|4).*\(\d\s*,\s*(\d)\)/i);
  if (d4) return parseInt(d4[1], 10);
  return -1;
}

export function deriveConfig(spec: RocketSpec): RocketConfig {
  const height = num(spec.height_m, 40);
  const diameter = num(spec.diameter_m, 3.5);
  const stages = Math.max(1, Math.min(4, Math.round(num(spec.stages, 2))));
  const thrust = num(spec.thrust_kn, 0);
  const realEngines = num(spec.engineCount, 0);
  const hay = `${spec.name ?? ""} ${spec.family ?? ""}`;

  const base: RocketConfig = {
    height,
    diameter,
    stages,
    boosters: 0,
    boosterKind: "none",
    fairing: /crew|dragon|soyuz|shenzhou|orion|apollo|gemini|mercury/i.test(hay) ? "capsule" : "fairing",
    // Prefer the real first-stage engine count; else ~1 nozzle per 1.2 MN of
    // thrust, clamped; else a width-based guess.
    engines:
      realEngines > 0
        ? Math.max(1, Math.min(33, realEngines))
        : thrust > 0
          ? Math.max(1, Math.min(9, Math.round(thrust / 1200)))
          : diameter > 4
            ? 4
            : 1,
    // Default: white painted aluminium (what most launch vehicles actually are).
    palette: { body: "#e9ebef", upper: "#dcdfe5", booster: "#d4d8df", accent: "#2b2f37" },
  };

  const rule = RULES.find((r) => r.test.test(hay));
  if (rule) {
    if (rule.boosters !== undefined) base.boosters = rule.boosters;
    if (rule.boosterKind) base.boosterKind = rule.boosterKind;
    if (rule.fairing) base.fairing = rule.fairing;
    // A curated engine count wins only when we don't have the real one.
    if (rule.engines !== undefined && realEngines <= 0) base.engines = rule.engines;
    if (rule.palette) base.palette = { ...base.palette, ...rule.palette };
  } else if (thrust > 8000 || diameter > 5) {
    // Heavy-lifter heuristic for unknown vehicles: give it strap-ons.
    base.boosters = diameter > 5 ? 4 : 2;
    base.boosterKind = "strapon";
  }

  // Exact booster count from the variant number overrides the family default.
  const variantBoosters = boostersFromVariant(hay);
  if (variantBoosters >= 0) {
    base.boosters = variantBoosters;
    if (variantBoosters === 0) base.boosterKind = "none";
    else if (base.boosterKind === "none") base.boosterKind = "srb";
  }

  return base;
}
