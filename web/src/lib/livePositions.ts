// Decoder for the live-tracker WebSocket stream.
//
// The server sends a flat numeric array — five values per satellite:
//   [norad, lat, lng, altKm, velKmS, norad, lat, ...]
// rather than an array of JSON objects. Repeating six field names plus the
// satellite name for ~16k objects every tick cost 1.7 MB per broadcast per
// viewer (~1.2 GB per viewer-hour). Names are not streamed at all: the client
// already holds them from /api/v1/track/meta, keyed by the same NORAD id.
//
// The object form is still accepted so a browser running cached JS from before
// the change keeps working against a new server during the rollout.

export interface LivePos {
  norad_id: number;
  lat: number;
  lng: number;
  altitude_km: number;
  velocity_km_s: number;
  /** Only present on the legacy object payload; look names up in `meta`. */
  name?: string;
}

const STRIDE = 5;

export function decodeLivePositions(raw: string): LivePos[] {
  let d: unknown;
  try {
    d = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(d) || d.length === 0) return [];

  // Legacy: array of objects.
  if (typeof d[0] === "object") return d as LivePos[];

  // Compact: flat numbers.
  const out: LivePos[] = [];
  for (let i = 0; i + STRIDE - 1 < d.length; i += STRIDE) {
    out.push({
      norad_id: d[i] as number,
      lat: d[i + 1] as number,
      lng: d[i + 2] as number,
      altitude_km: d[i + 3] as number,
      velocity_km_s: d[i + 4] as number,
    });
  }
  return out;
}
