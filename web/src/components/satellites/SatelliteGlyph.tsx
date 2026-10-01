"use client";

import { memo } from "react";
import { profile, type Feature } from "./satelliteProfile";

// A card visual for catalogue entries that have no photograph.
//
// Only ~3% of the 27k objects carry an image_url, and the gap is almost entirely
// mega-constellations — there will never be a photo of an individual Starlink —
// so a photo-only grid leaves most cards blank. This draws the object from the
// fields every row does have: an orbital-shell diagram for the altitude band, a
// silhouette built from the same purpose profile the 3D detail model uses, and
// bounded jitter off the NORAD id so a screen of constellation siblings doesn't
// read as one repeated tile.
//
// Inline SVG with no <defs> and no gradients: it renders up to 120 times per
// page, so element count and avoiding per-card ids matter more than fidelity.
// The glow behind it is a Tailwind background on the card instead.

const W = 160;
const H = 100;
const CX = W / 2;
const CY = 230; // shell centre, far below the frame, so arcs read as near-flat
const EARTH_R = 150;
const SHELL_R = [162, 178, 194];

/** y where a circle of radius r about (CX, CY) crosses the frame's side edges. */
const edgeY = (r: number) => CY - Math.sqrt(r * r - CX * CX);

/** Arc across the full frame width, over the top of the circle. */
const arc = (r: number) => `M 0 ${edgeY(r).toFixed(2)} A ${r} ${r} 0 0 1 ${W} ${edgeY(r).toFixed(2)}`;

interface Band {
  shell: number;
  colour: string;
  code: string;
  /** Beyond Earth orbit: the object leaves the diagram. */
  escape: boolean;
}

// Altitude band → which shell the object rides and the accent that goes with it.
// Shell radius carries the same information as the colour, so the diagram still
// reads for anyone who can't separate the four hues.
function band(orbitType?: string | null): Band {
  const o = (orbitType || "").trim().toUpperCase();
  if (o === "LEO") return { shell: 0, colour: "#7df9ff", code: "LEO", escape: false };
  if (o === "MEO") return { shell: 1, colour: "#5b8cff", code: "MEO", escape: false };
  if (o === "GEO" || o === "GSO") return { shell: 2, colour: "#d7a63c", code: "GEO", escape: false };
  return { shell: 2, colour: "#dfe6f2", code: o || "UNCAT", escape: o !== "" && o !== "HEO" };
}

// xorshift32. Deterministic for a given NORAD id, so a satellite's card is
// always the same picture — jitter that changed between renders would make the
// whole grid shuffle on every keystroke in the search box.
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

function Payload({ body, feature, colour, cells }: { body: string; feature: Feature; colour: string; cells: number }) {
  return (
    <>
      {/* Solar wings on booms, with cell seams */}
      {[-1, 1].map((dir) => (
        <g key={dir}>
          <path d={`M ${dir * 5} 0 H ${dir * 9}`} stroke="#6a727f" strokeWidth="0.8" />
          <rect x={dir === 1 ? 9 : -23} y={-4.5} width="14" height="9" fill="#15305e" stroke={colour} strokeOpacity="0.4" strokeWidth="0.4" />
          {Array.from({ length: cells }, (_, i) => {
            const x = (dir === 1 ? 9 : -23) + (14 * (i + 1)) / (cells + 1);
            return <path key={i} d={`M ${x.toFixed(2)} -4.5 V 4.5`} stroke="#2f518f" strokeWidth="0.4" />;
          })}
        </g>
      ))}

      {/* Central bus — MLI-foil look, blanket seams included */}
      <rect x="-5" y="-6" width="10" height="12" rx="0.8" fill={body} stroke="#05070f" strokeWidth="0.5" />
      <path d="M -5 -2 H 5 M -5 2 H 5" stroke="#05070f" strokeOpacity="0.35" strokeWidth="0.45" />

      {feature === "dish" && (
        <>
          <path d="M -7.5 -8 Q 0 -14.5 7.5 -8 Z" fill="#e8ecf4" fillOpacity="0.16" stroke="#dbe2ec" strokeWidth="0.9" />
          <path d="M 0 -11.5 V -6" stroke="#9aa2ae" strokeWidth="0.7" />
        </>
      )}
      {feature === "telescope" && (
        <>
          <rect x="-3.5" y="-17" width="7" height="11" fill="#23262e" stroke="#8d96a6" strokeWidth="0.6" />
          <path d="M -3.5 -17 H 3.5" stroke={colour} strokeWidth="1.1" strokeOpacity="0.8" />
        </>
      )}
      {feature === "sensor" && (
        <>
          {/* Looking down the gravity gradient — the swath lands on the limb */}
          <path d="M -4 11 L -9 34 H 9 L 4 11 Z" fill={colour} fillOpacity="0.09" />
          <path d="M -2.5 6 H 2.5 L 4 11 H -4 Z" fill="#15171c" stroke="#7b8490" strokeWidth="0.5" />
        </>
      )}
      {feature === "module" && <rect x="-3" y="-14" width="6" height="8" rx="3" fill="#cfd4dc" stroke="#05070f" strokeWidth="0.4" />}
      {(feature === "antenna" || feature === "module") && (
        <>
          <path d="M 0 -6 V -16" stroke="#9aa2ae" strokeWidth="0.7" />
          <circle cx="0" cy="-16.8" r="1.2" fill={colour} fillOpacity="0.85" />
        </>
      )}
    </>
  );
}

/** NORAD id when there is one; a stable hash of the slug otherwise (FNV-1a). */
export function glyphSeed(noradId: number | null | undefined, slug: string): number {
  if (noradId) return noradId;
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) h = Math.imul(h ^ slug.charCodeAt(i), 16777619);
  return h >>> 0;
}

export type GlyphProps = {
  name: string;
  purpose?: string | null;
  orbitType?: string | null;
  objectType?: string | null;
  /** NORAD id where we have one — see glyphSeed. */
  seed: number;
};

// Primitive props only, so memo's shallow compare actually holds: the list
// re-renders on every keystroke while the results are still the previous ones.
export const SatelliteGlyph = memo(function SatelliteGlyph({ name, purpose, orbitType, objectType, seed }: GlyphProps) {
  const b = band(orbitType);
  const { body, feature } = profile(purpose);
  const kind = (objectType || "PAY").trim().toUpperCase();
  const rnd = rand(seed);

  const stars = Array.from({ length: 9 }, () => ({
    x: 3 + rnd() * (W - 6),
    y: 3 + rnd() * 56,
    r: 0.35 + rnd() * 0.5,
    o: 0.14 + rnd() * 0.32,
  }));

  // Ride the shell near its apex, so the object sits at the altitude its orbit
  // class implies rather than at an arbitrary point on the card.
  const r = SHELL_R[b.shell];
  const dx = (rnd() - 0.5) * 40;
  const sx = CX + dx;
  const sy = CY - Math.sqrt(r * r - dx * dx);
  const tilt = (rnd() - 0.5) * 26;
  const cells = 2 + Math.floor(rnd() * 2);

  const label = kind === "PAY" ? b.code : `${b.code} · ${kind}`;
  const what = kind === "R/B" ? "spent rocket stage" : kind === "DEB" ? "debris fragment" : `${purpose || "uncategorised"} satellite`;
  const where = b.code === "UNCAT" ? "an unclassified orbit" : b.code;

  return (
    <div className="absolute inset-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
        role="img"
        aria-label={`Diagram of ${name}: ${what} in ${where}`}
      >
        {stars.map((s, i) => (
          <circle key={i} cx={s.x.toFixed(2)} cy={s.y.toFixed(2)} r={s.r.toFixed(2)} fill="#fff" fillOpacity={s.o.toFixed(2)} />
        ))}

        {/* The shells this object doesn't occupy, so its own band reads as a height */}
        {SHELL_R.map((sr, i) =>
          i === b.shell ? null : <path key={sr} d={arc(sr)} fill="none" stroke="#fff" strokeOpacity="0.08" strokeWidth="0.6" />,
        )}
        <path d={arc(r)} fill="none" stroke={b.colour} strokeOpacity="0.5" strokeWidth="0.9" />

        <circle cx={CX} cy={CY} r={EARTH_R} fill="#0a1220" />
        <path d={arc(EARTH_R - 7)} fill="none" stroke="#fff" strokeOpacity="0.05" strokeWidth="0.6" />
        <path d={arc(EARTH_R)} fill="none" stroke={b.colour} strokeOpacity="0.55" strokeWidth="1" />
        <path d={arc(EARTH_R + 2.5)} fill="none" stroke={b.colour} strokeOpacity="0.14" strokeWidth="2.5" />

        {b.escape && (
          <path
            d={`M ${sx.toFixed(2)} ${sy.toFixed(2)} L ${(CX + (dx / r) * (r + 150)).toFixed(2)} ${(CY - ((CY - sy) / r) * (r + 150)).toFixed(2)}`}
            stroke={b.colour}
            strokeOpacity="0.45"
            strokeWidth="0.7"
            strokeDasharray="2.5 3"
          />
        )}

        <g transform={`translate(${sx.toFixed(2)} ${sy.toFixed(2)}) rotate(${tilt.toFixed(1)}) scale(1.35)`}>
          {kind === "R/B" ? (
            <>
              <rect x="-4" y="-12" width="8" height="21" rx="1" fill="#3b424e" stroke="#8d96a6" strokeWidth="0.6" />
              <path d="M -4 9 L -6.5 15 H 6.5 L 4 9 Z" fill="#20242c" stroke="#7b8490" strokeWidth="0.5" />
              <path d="M -4 -5 H 4 M -4 1 H 4" stroke="#6a727f" strokeWidth="0.4" />
            </>
          ) : kind === "DEB" ? (
            <>
              <path d="M -5 -3 L 0 -6.5 L 4.5 -1 L -1 3.5 Z" fill="#59616e" stroke="#9aa2ae" strokeWidth="0.5" />
              <path d="M 5.5 -7 L 9 -4.5 L 6.5 -1 Z" fill="#434a56" stroke="#8d96a6" strokeWidth="0.4" />
              <path d="M -9 4 L -5.5 6.5 L -8 9 Z" fill="#434a56" stroke="#8d96a6" strokeWidth="0.4" />
            </>
          ) : (
            <Payload body={body} feature={feature} colour={b.colour} cells={cells} />
          )}
        </g>
      </svg>
      <span className="absolute top-2 right-3 text-[9px] font-mono uppercase tracking-[0.2em]" style={{ color: b.colour, opacity: 0.5 }}>
        {label}
      </span>
    </div>
  );
});
