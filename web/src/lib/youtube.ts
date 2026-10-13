// Shared by server pages and the client facade (kept out of the "use client"
// module so server components can call it).

/** Extract an 11-char video id from any common YouTube URL shape. */
export function youTubeId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|live\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/);
  return m && m[2].length === 11 ? m[2] : null;
}
