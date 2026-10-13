import type { YearSummary } from "@/lib/api";

// Orbital launches per year since Sputnik, as a pure SVG (server-rendered, no
// client JS). The shape tells the story at a glance: the 1960s–80s Cold War
// plateau, the post-Soviet trough, and the reusable-rocket surge.
export function LaunchHistogram({ years, className = "" }: { years: YearSummary[]; className?: string }) {
  const thisYear = new Date().getUTCFullYear();
  // The yearly rollup also counts launches that are only scheduled; for the
  // current year plot what has actually flown (successes + failures so far).
  const data = years
    .filter((y) => y.launch_year >= 1957 && y.launch_year <= thisYear)
    .map((y) => (y.launch_year === thisYear ? { ...y, total_launches: y.successes + y.failures } : y))
    .sort((a, b) => a.launch_year - b.launch_year);
  if (data.length < 2) return null;

  const W = 640;
  const H = 150;
  const PAD_B = 18;
  const max = Math.max(1, ...data.map((d) => d.total_launches));
  const peak = data.reduce((p, d) => (d.total_launches > p.total_launches ? d : p), data[0]);
  const slot = W / data.length;
  const barW = Math.max(1.5, slot - 1.5);
  const first = data[0].launch_year;
  const ticks = [1960, 1980, 2000, 2020].filter((t) => t >= first && t <= thisYear);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`h-auto w-full ${className}`}
      role="img"
      aria-label={`Orbital launches per year, ${first}–${thisYear}. Peak: ${peak.launch_year} with ${peak.total_launches} launches.`}
    >
      <defs>
        <linearGradient id="lh-bar" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#7df9ff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#5b8cff" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={W} y1={(H - PAD_B) * f} y2={(H - PAD_B) * f} stroke="rgb(148 170 220 / 0.08)" />
      ))}
      {data.map((d, i) => {
        const h = Math.max(1, (d.total_launches / max) * (H - PAD_B - 6));
        const isPeak = d.launch_year === peak.launch_year;
        return (
          <rect
            key={d.launch_year}
            x={i * slot}
            y={H - PAD_B - h}
            width={barW}
            height={h}
            fill={isPeak ? "#7df9ff" : "url(#lh-bar)"}
            opacity={isPeak ? 1 : 0.85}
          />
        );
      })}
      {ticks.map((t) => {
        const x = (t - first) * slot;
        return (
          <g key={t}>
            <line x1={x} x2={x} y1={H - PAD_B} y2={H - PAD_B + 4} stroke="rgb(148 170 220 / 0.35)" />
            <text x={x} y={H - 3} fill="rgb(232 238 255 / 0.4)" fontSize="10" fontFamily="var(--font-mono)" textAnchor="middle">
              {t}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
