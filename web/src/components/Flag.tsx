import { flagUrl, country } from "@/lib/flags";

// Real country flag (SVG from flagcdn). Falls back to the raw code chip.
export function Flag({ code, className = "" }: { code?: string | null; className?: string }) {
  const url = flagUrl(code);
  if (!url) {
    return (
      <span
        className={`inline-grid place-items-center bg-white/5 border border-white/10 text-[9px] tracking-wider text-white/40 font-mono ${className}`}
      >
        {code && code !== "???" ? code : "—"}
      </span>
    );
  }
  const c = country(code);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={c?.name ?? code ?? ""}
      title={c?.name ?? undefined}
      loading="lazy"
      decoding="async"
      className={`object-cover border border-white/10 ${className}`}
    />
  );
}
