"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Hamburger + full-screen overlay menu for phones/tablets. The desktop inline
// nav (hidden below md) is replaced by this trigger, so navigation works on
// every screen size. Closes on route change, Escape, and link tap.
export default function MobileNav({ items }: { items: string[][] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close whenever the route changes (a link was tapped).
  useEffect(() => setOpen(false), [pathname]);

  // Lock body scroll + close on Escape while the menu is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="grid place-items-center w-9 h-9 -mr-1 text-white"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 top-16 z-40 bg-[#04060d]/97 backdrop-blur-md">
          <nav className="flex flex-col px-6 py-6">
            {items.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="border-b border-white/10 py-5 text-sm tracking-[0.25em] uppercase text-white/80 hover:text-white transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
