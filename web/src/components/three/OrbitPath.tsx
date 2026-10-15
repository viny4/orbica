"use client";

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { orbitPathWithShadow } from "./geo";

// Full orbital ellipse for the tracked satellite, split into the sunlit arc
// (bright) and the eclipse arc (dim red), so you can see where the spacecraft
// is in darkness. Propagation happens once per (line1, line2, epoch) change.
export function OrbitPath({
  line1,
  line2,
  when,
  color = "#7df9ff",
  shadowColor = "#ff5c7a",
  samples = 360,
}: {
  line1: string;
  line2: string;
  when?: Date;
  color?: string;
  shadowColor?: string;
  samples?: number;
}) {
  const segments = useMemo(() => {
    const pts = orbitPathWithShadow(line1, line2, samples, when);
    if (pts.length < 2) return [];

    const sun: [number, number, number][][] = [];
    const shadow: [number, number, number][][] = [];
    let cur: [number, number, number][] = [pts[0].position];
    let curShadow = pts[0].inShadow;

    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      if (p.inShadow !== curShadow) {
        // Close the current run at the transition point so segments touch.
        cur.push(p.position);
        (curShadow ? shadow : sun).push(cur);
        cur = [p.position];
        curShadow = p.inShadow;
      } else {
        cur.push(p.position);
      }
    }
    (curShadow ? shadow : sun).push(cur);

    return [
      ...sun.map((points) => ({ points, color, opacity: 0.85, width: 2.2 })),
      ...shadow.map((points) => ({ points, color: shadowColor, opacity: 0.4, width: 1.6 })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line1, line2, samples, when?.getTime()]);

  return (
    <>
      {segments.map((s, i) =>
        s.points.length > 1 ? (
          <Line
            key={i}
            points={s.points}
            color={s.color}
            lineWidth={s.width}
            transparent
            opacity={s.opacity}
            dashed={s.color === shadowColor}
            dashScale={40}
          />
        ) : null,
      )}
    </>
  );
}
