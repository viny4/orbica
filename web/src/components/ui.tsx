import Link from "next/link";

// Shared design primitives so every page speaks the same cinematic language.
// Visual rules live in globals.css (tokens + .card/.btn/.spec-list); these
// components only compose them.

export function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`eyebrow ${className}`}>{children}</p>;
}

export function PageHeader({
  title,
  eyebrow,
  meta,
  back,
  actions,
}: {
  title: string | React.ReactNode;
  eyebrow?: React.ReactNode;
  meta?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-10 sm:mb-12">
      {back && (
        <Link
          href={back.href}
          className="group mb-6 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-3 transition-colors hover:text-ink"
        >
          <span aria-hidden className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span>
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0 max-w-4xl">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h1 className="mt-4 text-title font-light uppercase tracking-tight text-balance break-words">
            {title}
          </h1>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
      </div>
      {meta && <div className="mt-5 text-sm text-ink-3">{meta}</div>}
    </header>
  );
}

/** Section heading: small tracked label with a hairline, optional count + action. */
export function SectionHeader({
  title,
  count,
  action,
  tone = "default",
  id,
}: {
  title: React.ReactNode;
  count?: number;
  action?: { href: string; label: string };
  tone?: "default" | "accent" | "danger";
  id?: string;
}) {
  const color = tone === "accent" ? "text-accent/80" : tone === "danger" ? "text-danger/80" : "text-ink-3";
  return (
    <div className="mb-5 flex items-baseline justify-between gap-4 border-b border-line pb-3">
      <h2 id={id} className={`font-mono text-[11px] uppercase tracking-[0.28em] ${color}`}>
        {title}
        {count !== undefined && <span className="ml-2 text-ink-4">· {count.toLocaleString("en-US")}</span>}
      </h2>
      {action && <ArrowLink href={action.href}>{action.label}</ArrowLink>}
    </div>
  );
}

/** Large section title used on the landing page and feature blocks. */
export function SectionTitle({
  eyebrow,
  title,
  description,
  action,
  tone,
}: {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: { href: string; label: string };
  tone?: "accent" | "danger" | "muted";
}) {
  const eyebrowColor = tone === "danger" ? "text-danger/80" : tone === "muted" ? "text-ink-3" : "";
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-6 border-b border-line pb-5">
      <div className="max-w-2xl">
        <Eyebrow className={eyebrowColor}>{eyebrow}</Eyebrow>
        <h2 className="mt-3 text-heading font-light uppercase tracking-tight text-balance">{title}</h2>
        {description && <p className="mt-3 text-sm leading-relaxed text-ink-3">{description}</p>}
      </div>
      {action && <ArrowLink href={action.href}>{action.label}</ArrowLink>}
    </div>
  );
}

/** Text link with a trailing arrow that nudges on hover. */
export function ArrowLink({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={`group inline-flex shrink-0 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-3 transition-colors hover:text-ink ${className}`}
    >
      {children}
      <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">→</span>
    </Link>
  );
}

// Editorial tile: sharp, thin border, accent on hover.
export const tileClass = "card card-link group p-5";

export function Chip({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "accent" | "success" | "danger" }) {
  const tones = {
    muted: "border-line-strong text-ink-3",
    accent: "border-accent/40 text-accent",
    success: "border-success/35 text-success",
    danger: "border-danger/35 text-danger",
  } as const;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] border ${tones[tone]}`}>
      {children}
    </span>
  );
}

// Outcomes are stored lowercase (success | failure | partial_failure | upcoming…);
// normalise anything else so a stray "Success" still gets its colour.
const OUTCOME_STYLE: Record<string, string> = {
  success: "text-success",
  failure: "text-danger",
  partial_failure: "text-warning",
  upcoming: "text-accent",
};

export function outcomeKey(outcome?: string | null): string {
  return (outcome ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

export function outcomeLabel(outcome?: string | null): string {
  const k = outcomeKey(outcome);
  return k ? k.replace(/_/g, " ") : "unknown";
}

// Outcome label with semantic colour.
export function Outcome({ outcome }: { outcome?: string | null }) {
  const color = OUTCOME_STYLE[outcomeKey(outcome)] ?? "text-ink-4";
  return <span className={`font-mono text-[10px] uppercase tracking-[0.2em] ${color}`}>{outcomeLabel(outcome)}</span>;
}

/** Key/value list for detail pages; rows with an empty value are dropped. */
export function SpecList({ rows, title, tone }: { rows: [string, React.ReactNode][]; title?: string; tone?: "danger" }) {
  const visible = rows.filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== false);
  if (!visible.length) return null;
  return (
    <section>
      {title && (
        <h2 className={`mb-4 font-mono text-[11px] uppercase tracking-[0.28em] ${tone === "danger" ? "text-danger/75" : "text-ink-3"}`}>
          {title}
        </h2>
      )}
      <dl className="spec-list">
        {visible.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Headline number with a label — stats rows, dashboards. */
export function StatTile({ label, value, hint, accent = false }: { label: string; value: React.ReactNode; hint?: React.ReactNode; accent?: boolean }) {
  return (
    <div className="tile p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">{label}</div>
      <div className={`mt-3 text-2xl font-light tabular-nums sm:text-3xl ${accent ? "text-accent" : "text-ink"}`}>{value}</div>
      {hint && <div className="mt-1.5 text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

/** Small live/freshness indicator dot. */
export function StatusDot({ tone = "success", pulse = false }: { tone?: "success" | "warning" | "danger" | "accent"; pulse?: boolean }) {
  const bg = { success: "bg-success", warning: "bg-warning", danger: "bg-danger", accent: "bg-accent" }[tone];
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      {pulse && <span className={`absolute inset-0 rounded-full ${bg} opacity-60 motion-safe:animate-ping`} />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${bg}`} />
    </span>
  );
}

/** "3h ago" style relative time (server-rendered, so coarse units only). */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 90) return "just now";
  const m = Math.round(s / 60);
  if (m < 90) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}
