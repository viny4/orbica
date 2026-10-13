"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, isActivePath } from "./nav";

// Desktop navigation. Destinations (ISS, Track, Intel) stay top-level; the rest
// group under two menus. Dropdowns are CSS-driven (hover + focus-within) so no
// JS state is needed, and they stay keyboard-accessible: tabbing onto the
// trigger opens the panel, tabbing past it closes it. Mobile uses MobileNav.

const linkBase = "font-mono text-[11px] uppercase tracking-[0.2em] transition-colors duration-150";

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="hidden items-center gap-7 md:flex lg:gap-9">
      {NAV.map((entry) => {
        if (!entry.items) {
          const active = isActivePath(pathname, entry.href);
          return (
            <Link
              key={entry.href}
              href={entry.href}
              aria-current={active ? "page" : undefined}
              className={`${linkBase} relative py-2 ${active ? "text-ink" : "text-ink-2 hover:text-ink"}`}
            >
              {entry.label}
              {active && <span aria-hidden className="absolute inset-x-0 -bottom-px h-px bg-accent" />}
            </Link>
          );
        }
        const groupActive = entry.items.some((i) => isActivePath(pathname, i.href));
        return (
          <div key={entry.label} className="group relative">
            <button
              type="button"
              aria-haspopup="true"
              className={`${linkBase} relative flex items-center gap-1.5 py-2 ${
                groupActive ? "text-ink" : "text-ink-2 group-hover:text-ink group-focus-within:text-ink"
              }`}
            >
              {entry.label}
              <svg width="8" height="8" viewBox="0 0 10 10" fill="none" aria-hidden className="transition-transform duration-200 group-hover:rotate-180 group-focus-within:rotate-180">
                <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              {groupActive && <span aria-hidden className="absolute inset-x-0 -bottom-px h-px bg-accent" />}
            </button>
            {/* pt-3 bridges the hover gap between trigger and panel */}
            <div className="invisible absolute left-1/2 top-full -translate-x-1/2 pt-3 opacity-0 transition-[opacity,visibility] duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <ul className="min-w-[260px] border border-line-strong bg-surface/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl">
                {entry.items.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`block px-4 py-2.5 transition-colors ${active ? "bg-white/[0.05]" : "hover:bg-white/[0.04]"}`}
                      >
                        <span className={`${linkBase} block ${active ? "text-accent" : "text-ink"}`}>{item.label}</span>
                        {item.description && <span className="mt-1 block text-xs text-ink-3">{item.description}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
