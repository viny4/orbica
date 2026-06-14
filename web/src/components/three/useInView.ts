"use client";

import { useEffect, useRef, useState } from "react";

// Tracks whether an element is on screen, and latches "armed" once it first
// becomes visible. Used to (a) defer mounting heavy WebGL canvases until the
// user actually scrolls to them, and (b) pause the render loop when off-screen.
export function useInView<T extends HTMLElement>(rootMargin = "200px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting) setArmed(true);
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return { ref, inView, armed };
}
