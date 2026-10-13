// Where the hero planet sits on screen, as fractions of the hero box: centre
// (cx, cy) and radius r (of the box HEIGHT). Shared by the CSS poster and the
// WebGL scene so the 3D Earth lands exactly on top of the placeholder when it
// fades in. Landscape: a large planet on the right, cropped by the bottom edge.
// Portrait: the limb arcs across the lower half like a horizon under the copy.

export interface PlanetPlacement {
  cx: number;
  cy: number;
  r: number;
}

export const PLANET_LANDSCAPE: PlanetPlacement = { cx: 0.74, cy: 0.68, r: 0.5 };
export const PLANET_PORTRAIT: PlanetPlacement = { cx: 0.5, cy: 1.08, r: 0.42 };

/** Portrait/landscape switch shared by CSS (media query) and the scene. */
export const PORTRAIT_MAX_ASPECT = 0.9;

export function placementFor(aspect: number): PlanetPlacement {
  return aspect < PORTRAIT_MAX_ASPECT ? PLANET_PORTRAIT : PLANET_LANDSCAPE;
}
