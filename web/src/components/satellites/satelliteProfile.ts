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
