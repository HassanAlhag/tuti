import { useEffect, useMemo, useRef, useState } from "react";

const MOBILE_MEDIA_QUERY = "(max-width: 820px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function useImmersiveStory(chapters) {
  const refs = useRef([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;

    const mobileQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);

    const syncMedia = () => {
      setIsMobile(mobileQuery.matches);
      setPrefersReducedMotion(reducedMotionQuery.matches);
    };

    syncMedia();
    mobileQuery.addEventListener("change", syncMedia);
    reducedMotionQuery.addEventListener("change", syncMedia);

    return () => {
      mobileQuery.removeEventListener("change", syncMedia);
      reducedMotionQuery.removeEventListener("change", syncMedia);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return undefined;
    if (isMobile || prefersReducedMotion) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (!visible.length) return;

        const idx = Number(visible[0].target.getAttribute("data-story-index") || 0);
        if (Number.isFinite(idx)) setActiveIndex(idx);
      },
      {
        rootMargin: "-25% 0px -25% 0px",
        threshold: [0.25, 0.45, 0.65, 0.85],
      }
    );

    refs.current.forEach((node) => {
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [isMobile, prefersReducedMotion, chapters.length]);

  const setChapterRef = (index) => (node) => {
    refs.current[index] = node;
  };

  const progress = useMemo(() => {
    if (!chapters.length) return 0;
    return (activeIndex + 1) / chapters.length;
  }, [activeIndex, chapters.length]);

  return {
    activeIndex,
    isMobile,
    prefersReducedMotion,
    progress,
    setChapterRef,
  };
}
