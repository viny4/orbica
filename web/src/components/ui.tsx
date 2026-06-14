import Link from "next/link";

// Shared design primitives so every page speaks the same cinematic language.

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] tracking-[0.35em] uppercase text-[var(--color-space-accent-2)]/75">
      {children}
    </p>
  );
}

export function PageHeader({
  eyebrow,
  title,
  meta,
  back,
}: {
  eyebrow?: string;
  title: string;
  meta?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-12">
      {back && (
        <Link
          href={back.href}
          className="inline-block mb-6 text-[11px] tracking-[0.25em] uppercase text-white/45 hover:text-white transition-colors"
        >
          ← {back.label}
        </Link>
      )}
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 className="mt-4 font-light uppercase leading-[0.95] tracking-tight text-5xl sm:text-6xl lg:text-7xl">
        {title}
      </h1>
      {meta && <div className="mt-5 text-sm text-white/50">{meta}</div>}
    </header>
  );
}

// Editorial tile: sharp, thin border, accent on hover. Replaces the old cards.
export const tileClass =
  "group relative block border border-white/10 bg-white/[0.015] p-5 transition-colors duration-300 hover:border-[var(--color-space-accent-2)]/50 hover:bg-white/[0.03]";

export function Chip({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "accent" }) {
  return (
    <span
      className={`text-[10px] tracking-[0.18em] uppercase px-2 py-0.5 border ${
        tone === "accent"
          ? "border-[var(--color-space-accent-2)]/40 text-[var(--color-space-accent-2)]"
          : "border-white/15 text-white/50"
      }`}
    >
      {children}
    </span>
  );
}

// Outcome label with semantic colour.
export function Outcome({ outcome }: { outcome: string }) {
  const color =
    outcome === "success"
      ? "text-emerald-400"
      : outcome === "failure"
        ? "text-red-400"
        : outcome === "partial_failure"
          ? "text-amber-400"
          : "text-white/40";
  return <span className={`text-[10px] uppercase tracking-[0.2em] font-mono ${color}`}>{outcome.replace("_", " ")}</span>;
}
