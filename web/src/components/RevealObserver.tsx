"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Drives the `.reveal` entrance animation (see globals.css) with ONE shared
// IntersectionObserver for the whole app, instead of a hook per element.
// Elements reveal once and are then unobserved, so scrolling back up costs
// nothing. Streamed-in and client-navigated content is picked up by a
// rAF-debounced MutationObserver scan.
export default function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      document.querySelectorAll(".reveal:not(.is-in)").forEach((el) => el.classList.add("is-in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
    );

    const scan = () => {
      document.querySelectorAll(".reveal:not(.is-in):not([data-rv])").forEach((el) => {
        el.setAttribute("data-rv", "");
        io.observe(el);
      });
    };
    scan();

    let raf = 0;
    const mo = new MutationObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        scan();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
      // Let the next page's scan re-register anything still pending.
      document.querySelectorAll(".reveal[data-rv]:not(.is-in)").forEach((el) => el.removeAttribute("data-rv"));
    };
  }, [pathname]);

  return null;
}
