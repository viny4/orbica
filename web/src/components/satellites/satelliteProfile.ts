// Palette + body feature derived from the spacecraft's purpose.
//
// Lives apart from the 3D model so the 2D card glyph can share it without
// pulling three.js into the satellites list bundle — the two renderings have to
// agree, or the same spacecraft looks like two different objects.

export type Feature = "dish" | "antenna" | "sensor" | "telescope" | "module";

export function profile(purpose?: string | null): { body: string; feature: Feature } {
  const p = (purpose || "").toLowerCase();
  if (p.includes("comm")) return { body: "#c8a23a", feature: "dish" };
  if (p.includes("navigation")) return { body: "#cdd3df", feature: "antenna" };
  if (p.includes("weather")) return { body: "#e7ecf5", feature: "sensor" };
  if (p.includes("earth")) return { body: "#3a4a63", feature: "sensor" };
  if (p.includes("telescope") || p.includes("science")) return { body: "#9aa7bd", feature: "telescope" };
  if (p.includes("human")) return { body: "#d7dbe2", feature: "module" };
  if (p.includes("planetary")) return { body: "#b8962f", feature: "dish" };
  return { body: "#aab4c8", feature: "antenna" };
}

// --- 3D only -------------------------------------------------------------

// The detail model needs a finer split than the card glyph does. `feature`
// above folds earth-observation and weather craft together (both get "sensor")
// because at 160x100px a scan head is a scan head; at full size they are
// obviously different vehicles. Archetype is additive on purpose — changing
// `profile` would change every card in the list.
export type Archetype = "navigation" | "comsat" | "flatsat" | "imager" | "telescope" | "weather" | "station" | "generic";

export function archetype(purpose?: string | null, orbitType?: string | null): Archetype {
  const p = (purpose || "").toLowerCase();
  const o = (orbitType || "").trim().toUpperCase();
  if (p.includes("navigation")) return "navigation";
  // A LEO comsat is a mass-produced flat-pack, not a dish bus — the difference
  // between a Starlink and an Intelsat is the most visible one in the catalogue.
  if (p.includes("comm")) return o === "LEO" ? "flatsat" : "comsat";
  if (p.includes("weather")) return "weather";
  if (p.includes("earth")) return "imager";
  if (p.includes("telescope") || p.includes("science")) return "telescope";
  if (p.includes("human")) return "station";
  if (p.includes("planetary")) return "comsat";
  return "generic";
}
