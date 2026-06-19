import { useEffect, useState } from "react";
import { ArrowRight, Pause, Play } from "lucide-react";
import { homeStoryChapters } from "../../data/homeStoryChapters.js";
import { useImmersiveStory } from "./useImmersiveStory.js";
import "./immersive.css";

/* D1.1X — Apple-like Media Hero.
   Single-viewport hero (~85svh). All four chapter images are stacked in the DOM;
   the active one crossfades in (700ms). A highlight card rail inside the hero lets
   the user click to change chapter. Copy re-animates (fade+rise) on chapter change.
   Auto-advance every 6 s, paused on hover/focus or explicit user toggle, disabled
   under prefers-reduced-motion. is-story class preserved for ClientLayout topbar
   observer compatibility. */

const chapters = homeStoryChapters;
const ADVANCE_MS = 6000;

export function ImmersiveStory({ onBuildGift }) {
  const { prefersReducedMotion } = useImmersiveStory();
  const [activeChapter, setActiveChapter] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isUserPaused, setIsUserPaused] = useState(false);
  const [timerKey, setTimerKey] = useState(0);

  /* Auto-advance — clears and restarts whenever isPaused, isUserPaused,
     prefersReducedMotion, or timerKey changes. timerKey increments on manual
     card click to reset the 6-second window from zero after every user
     interaction. isUserPaused is the explicit pause button state; isPaused
     is the hover/focus transient state. Both independently halt auto-advance. */
  useEffect(() => {
    if (prefersReducedMotion || isPaused || isUserPaused) return;
    const id = setInterval(() => {
      setActiveChapter(prev => (prev + 1) % chapters.length);
    }, ADVANCE_MS);
    return () => clearInterval(id);
  }, [prefersReducedMotion, isPaused, isUserPaused, timerKey]);

  function selectChapter(i) {
    setActiveChapter(i);
    setTimerKey(k => k + 1);
  }

  const chapter = chapters[activeChapter];
  const isFirst = activeChapter === 0;
  const isLast = activeChapter === chapters.length - 1;

  return (
    <section
      className="is-hero is-story"
      aria-label="Tuti gift journey"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setIsPaused(false);
      }}
    >
      <h1 className="is-sr-only">Tuti — Thoughtful gifting, made personal</h1>

      {/* All four images stacked absolutely. Active image: opacity 1, others: 0.
          Crossfade is pure CSS transition — no JS required for the visual effect.
          aria-hidden on the wrapper; screen readers get the copy block instead.
          Chapter 1 loads eagerly; chapters 2–4 lazy-load for performance. */}
      <div className="is-images" aria-hidden="true">
        {chapters.map((ch, i) => (
          <img
            key={ch.id}
            className={`is-image${i === activeChapter ? " is-image--active" : ""}`}
            src={ch.image}
            alt=""
            loading={i === 0 ? "eager" : "lazy"}
          />
        ))}
      </div>

      {/* Single gradient layer covers the full hero. No per-chapter gradient needed
          since all images share the same dark-bottom composition. */}
      <div className="is-gradient" aria-hidden="true" />

      {/* Body: flex column with justify-end anchors copy and cards to the bottom. */}
      <div className="is-body">

        {/* key={activeChapter} forces React to remount this div on every chapter
            change, restarting the CSS entrance animation each time. */}
        <div className="is-copy" key={activeChapter}>
          <span className="is-kicker">{chapter.kicker}</span>
          <h2 className="is-headline">{chapter.title}</h2>
          <p>{chapter.body}</p>

          {isFirst && (
            <button className="is-invite" type="button" onClick={onBuildGift}>
              Build your gift <ArrowRight size={13} aria-hidden="true" />
            </button>
          )}
          {isLast && (
            <button className="is-cta primary-action" type="button" onClick={onBuildGift}>
              Build Your Gift <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Highlight card rail. role="group" + aria-label names the region for
            screen readers without claiming full navigation landmark semantics. */}
        <div className="is-cards" role="group" aria-label="Gift journey steps">
          {chapters.map((ch, i) => (
            <button
              key={ch.id}
              className={`is-card${i === activeChapter ? " is-card--active" : ""}`}
              type="button"
              aria-pressed={i === activeChapter}
              aria-label={ch.title}
              onClick={() => selectChapter(i)}
            >
              <span className="is-card-num" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="is-card-title">{ch.title}</span>
            </button>
          ))}
        </div>

        {/* Pause/play toggle — WCAG 2.2.2 explicit mechanism for auto-advancing
            content > 5 s. Hidden entirely when prefersReducedMotion is true since
            auto-advance is already disabled via the useEffect guard. */}
        {!prefersReducedMotion && (
          <button
            className={`is-pause-btn${isUserPaused ? " is-pause-btn--paused" : ""}`}
            type="button"
            aria-pressed={isUserPaused}
            aria-label={isUserPaused ? "Play hero animation" : "Pause hero animation"}
            onClick={() => setIsUserPaused(p => !p)}
          >
            {isUserPaused
              ? <Play size={10} aria-hidden="true" />
              : <Pause size={10} aria-hidden="true" />
            }
          </button>
        )}

      </div>
    </section>
  );
}
