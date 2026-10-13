"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, isActivePath } from "./nav";
import { useFocusTrap } from "@/hooks/useFocusTrap";

// Full-screen menu for phones/tablets, laid out as the same groups the desktop
// dropdowns use (not a flat list of eleven links). It's a modal dialog: focus
// moves into it on open, Tab stays inside, Escape or a route change closes it,
// and focus returns to the trigger.
export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close whenever the route changes (a link was tapped).
  useEffect(() => setOpen(false), [pathname]);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const tone = (active: boolean) => (active ? "text-accent" : "text-ink hover:text-accent");
  const linkCls = (active: boolean) =>
    `flex items-center justify-between py-3.5 text-[15px] tracking-wide transition-colors ${tone(active)}`;
  const topCls = (active: boolean) =>
    `flex items-center justify-between border-b border-line py-4 font-mono text-xs uppercase tracking-[0.25em] transition-colors ${tone(active)}`;

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="-mr-1.5 grid h-10 w-10 place-items-center text-ink"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 7h18M3 12h18M3 17h18" />}
        </svg>
      </button>

      {open && (
        <div
          id="mobile-menu"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto overscroll-contain bg-void/[0.98] backdrop-blur-md"
        >
          <nav className="shell py-6" aria-label="Mobile">
            {NAV.map((entry) =>
              entry.items ? (
                <section key={entry.label} className="mt-6 first:mt-0">
                  <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-4">{entry.label}</h2>
                  <ul className="mt-1 divide-y divide-line border-b border-line">
                    {entry.items.map((item) => {
                      const active = isActivePath(pathname, item.href);
                      return (
                        <li key={item.href}>
                          <Link href={item.href} aria-current={active ? "page" : undefined} className={linkCls(active)}>
                            <span>{item.label}</span>
                            {item.description && <span className="ml-4 truncate text-xs text-ink-4">{item.description}</span>}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : (
                <Link
                  key={entry.href}
                  href={entry.href}
                  aria-current={isActivePath(pathname, entry.href) ? "page" : undefined}
                  className={topCls(isActivePath(pathname, entry.href))}
                >
                  {entry.label}
                  <span aria-hidden className="text-ink-4">→</span>
                </Link>
              ),
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
