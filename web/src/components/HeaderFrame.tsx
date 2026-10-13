"use client";

import { useEffect, useState } from "react";

// The header floats transparently over the landing hero, then picks up a
// frosted backdrop + hairline once the page scrolls, so nav text never sits on
// top of moving content. One passive listener, rAF-throttled.
export default function HeaderFrame({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      setScrolled(window.scrollY > 8);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header
      data-scrolled={scrolled || undefined}
      className="fixed inset-x-0 top-0 z-50 border-b border-transparent transition-[background-color,border-color,backdrop-filter] duration-300 data-[scrolled]:border-line data-[scrolled]:bg-void/75 data-[scrolled]:backdrop-blur-xl"
    >
      {children}
    </header>
  );
}
