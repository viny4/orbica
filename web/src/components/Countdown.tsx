"use client";

import { useNow, countdown } from "@/hooks/useNow";

// Live T-minus countdown on the shared page clock. Renders a fixed-width
// placeholder during SSR/hydration so the layout doesn't shift on the first tick.

export function Countdown({ target, variant = "inline" }: { target: string; variant?: "inline" | "hero" }) {
  const now = useNow();
  const t = Date.parse(target);

  if (variant === "hero") {
    const c = now ? countdown(t, now) : null;
    const cells: [string, string][] = c
      ? [
          ...(c.days > 0 ? ([[String(c.days), "Days"]] as [string, string][]) : []),
          [c.hours, "Hrs"],
          [c.mins, "Min"],
          [c.secs, "Sec"],
        ]
      : [
          ["--", "Hrs"],
          ["--", "Min"],
          ["--", "Sec"],
        ];
    return (
      <div className="flex items-end gap-3 font-mono tabular-nums sm:gap-5" aria-live="off" role="timer" aria-label="Time until launch">
        {cells.map(([v, l]) => (
          <div key={l} className="flex flex-col items-center">
            <span className={`text-3xl font-light leading-none sm:text-5xl ${c?.soon ? "text-accent" : "text-ink"}`}>{v}</span>
            <span className="mt-2 text-[9px] uppercase tracking-[0.25em] text-ink-4">{l}</span>
          </div>
        ))}
      </div>
    );
  }

  if (!now) return <span className="inline-block w-[7.5ch] font-mono text-sm tabular-nums text-ink-4">T- --:--:--</span>;
  const c = countdown(t, now);
  return (
    <span className={`font-mono text-sm tabular-nums tracking-wider ${c.soon ? "text-accent" : "text-ink-2"}`}>
      {c.diff === 0 ? "Window open" : `T- ${c.text}`}
    </span>
  );
}
