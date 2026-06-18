import { useEffect, useState } from "react";

/* Simplified for Concept B — natural vertical scroll redesign (D1.1R).
   The sticky/pinned chapter tracking, IntersectionObserver sentinel system,
   activeIndex, progress, and isMobile tracking have all been removed.
   Scroll behaviour is now handled by the document flow and CSS.
   This hook is retained for prefers-reduced-motion awareness. */

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function useImmersiveStory() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    setPrefersReducedMotion(query.matches);
    const on = () => setPrefersReducedMotion(query.matches);
    query.addEventListener("change", on);
    return () => query.removeEventListener("change", on);
  }, []);

  return { prefersReducedMotion };
}
