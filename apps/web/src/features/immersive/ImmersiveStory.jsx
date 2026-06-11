import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { homeStoryChapters } from "../../data/homeStoryChapters.js";
import { useImmersiveStory } from "./useImmersiveStory.js";
import "./immersive.css";

const chapters = homeStoryChapters;

function scrollToChapter(outerRef, index) {
  if (!outerRef.current) return;
  const top = outerRef.current.offsetTop + index * window.innerHeight;
  window.scrollTo({ top, behavior: "smooth" });
}

// ── Desktop full-viewport layout ──────────────────────────────────────────────
function ImmersiveDesktop({ activeIndex, progress, setChapterRef, onBuildGift }) {
  const outerRef = useRef(null);
  const current  = chapters[activeIndex] || chapters[0];

  return (
    <div className="is-outer" ref={outerRef}>

      {/* Sticky visual stage */}
      <div className="is-stage" aria-labelledby="is-ch-title" role="region" aria-label="Gifting story">

        {/* Full-bleed image layers — crossfade via .active */}
        <div className="is-images" aria-hidden="true">
          {chapters.map((ch, i) => (
            <div key={ch.id} className={`is-frame${i === activeIndex ? " active" : ""}`}>
              <img src={ch.image} alt="" />
            </div>
          ))}
          <div className="is-gradient" />
        </div>

        {/* Bottom-left copy block — keyed so entrance animation reruns on chapter change */}
        <div className="is-copy" key={activeIndex}>
          <span className="is-kicker">{current.kicker}</span>
          {/* h1: primary page heading — only the desktop sticky stage renders this */}
          <h1 id="is-ch-title" className="is-headline">{current.title}</h1>
          <p>{current.body}</p>
          {activeIndex === chapters.length - 1 && (
            <button className="is-cta primary-action" type="button" onClick={onBuildGift}>
              Build Your Gift <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Right-side chapter navigation */}
        <nav className="is-chapter-nav" aria-label="Story chapters">
          {chapters.map((ch, i) => (
            <button
              key={ch.id}
              type="button"
              className={`is-ch-btn${i === activeIndex ? " active" : ""}`}
              aria-current={i === activeIndex ? "true" : undefined}
              onClick={() => scrollToChapter(outerRef, i)}
            >
              <span className="is-ch-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="is-ch-label">{ch.kicker.split(" — ")[1]}</span>
            </button>
          ))}
        </nav>

        {/* Bottom progress line */}
        <div className="is-progress" aria-hidden="true">
          <div
            className="is-progress-bar"
            style={{ width: `${Math.max(progress * 100, 4)}%` }}
          />
        </div>
      </div>

      {/* Invisible scroll sentinels — drive IntersectionObserver */}
      <div className="is-scroll-track" aria-hidden="true">
        {chapters.map((ch, i) => (
          <div
            key={ch.id}
            className="is-sentinel"
            data-story-index={i}
            ref={setChapterRef(i)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Mobile / reduced-motion stacked layout ────────────────────────────────────
function ImmersiveMobile({ onBuildGift }) {
  return (
    <div className="is-mobile">
      {chapters.map((ch, i) => (
        <section key={ch.id} className="is-mobile-ch" aria-label={ch.title}>
          <img className="is-mobile-img" src={ch.image} alt={ch.alt} />
          <div className="is-mobile-gradient" aria-hidden="true" />
          <div className="is-mobile-copy">
            <span className="is-kicker">{ch.kicker}</span>
            <h2>{ch.title}</h2>
            <p>{ch.body}</p>
            {i === chapters.length - 1 && (
              <button className="is-cta primary-action" type="button" onClick={onBuildGift}>
                Build Your Gift <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────
export function ImmersiveStory({ onBuildGift }) {
  const { activeIndex, isMobile, prefersReducedMotion, progress, setChapterRef } =
    useImmersiveStory(chapters);

  if (isMobile || prefersReducedMotion) {
    return <ImmersiveMobile onBuildGift={onBuildGift} />;
  }

  return (
    <ImmersiveDesktop
      activeIndex={activeIndex}
      progress={progress}
      setChapterRef={setChapterRef}
      onBuildGift={onBuildGift}
    />
  );
}
