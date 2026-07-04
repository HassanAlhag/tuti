import { useCallback, useEffect, useRef, useState } from "react";

const cx = (...parts) => parts.filter(Boolean).join(" ");

export function TutiCarousel({
  title,
  eyebrow,
  subtitle,
  items = [],
  renderItem,
  viewAll,
  className = "",
  itemLabel = "carousel item",
  ...props
}) {
  const trackRef = useRef(null);
  const [scrollState, setScrollState] = useState({ canScroll: false, atStart: true, atEnd: true });

  const updateScrollState = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    const current = track.scrollLeft;
    setScrollState({
      canScroll: maxScroll > 2,
      atStart: current <= 2,
      atEnd: current >= maxScroll - 2,
    });
  }, []);

  useEffect(() => {
    updateScrollState();
    const track = trackRef.current;
    if (!track) return undefined;

    const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(updateScrollState) : null;
    resizeObserver?.observe(track);
    track.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      resizeObserver?.disconnect();
      track.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [items.length, updateScrollState]);

  const move = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    const distance = Math.max(track.clientWidth * 0.82, 260);
    track.scrollBy({ left: direction * distance, behavior: "smooth" });
  };

  return (
    <section className={cx("tuti-carousel", className)} {...props}>
      {(eyebrow || title || subtitle || viewAll || scrollState.canScroll) ? (
        <div className="tuti-carousel__header">
          <div>
            {eyebrow ? <p className="tuti-carousel__eyebrow">{eyebrow}</p> : null}
            {title ? <h2 className="tuti-carousel__title">{title}</h2> : null}
            {subtitle ? <p className="tuti-carousel__subtitle">{subtitle}</p> : null}
          </div>
          <div className="tuti-carousel__actions">
            {viewAll}
            {scrollState.canScroll ? (
              <div className="tuti-carousel__arrows" aria-label={`${title || "Carousel"} controls`}>
                <button
                  type="button"
                  className="tuti-carousel__arrow"
                  onClick={() => move(-1)}
                  disabled={scrollState.atStart}
                  aria-label="Previous items"
                >
                  <span aria-hidden="true">‹</span>
                </button>
                <button
                  type="button"
                  className="tuti-carousel__arrow"
                  onClick={() => move(1)}
                  disabled={scrollState.atEnd}
                  aria-label="Next items"
                >
                  <span aria-hidden="true">›</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="tuti-carousel__viewport">
        <div className="tuti-carousel__track" ref={trackRef}>
          {items.map((item, index) => (
            <div className="tuti-carousel__item" key={item?.id || item?.slug || index} aria-label={`${itemLabel} ${index + 1}`}>
              {renderItem ? renderItem(item, index) : item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
