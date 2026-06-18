import { ArrowRight } from "lucide-react";
import { homeStoryChapters } from "../../data/homeStoryChapters.js";
import "./immersive.css";

/* D1.1R Concept B — Natural Vertical Editorial Scroll Story.
   Replaces the sticky/pinned architecture with four full-height document-flow
   sections. The page moves naturally. Each chapter scrolls into view with a
   CSS-driven parallax image and copy reveal (progressive enhancement via
   animation-timeline: view()). Desktop and mobile share one layout. */

const chapters = homeStoryChapters;

export function ImmersiveStory({ onBuildGift }) {
  return (
    <div className="is-story">
      {/* Visually-hidden h1 gives the document one primary heading.
          Each visible chapter title uses h2. */}
      <h1 className="is-sr-only">Tuti — Thoughtful gifting, made personal</h1>

      {chapters.map((ch, i) => {
        const isFirst = i === 0;
        const isLast  = i === chapters.length - 1;

        return (
          <section
            key={ch.id}
            className={`is-ch${isFirst ? " is-ch--first" : ""}`}
            aria-label={ch.title}
          >
            {/* Full-bleed image — oversized height gives CSS parallax room to move */}
            <img className="is-ch-img" src={ch.image} alt={ch.alt} />
            <div className="is-ch-gradient" aria-hidden="true" />

            <div className="is-ch-copy">
              <span className="is-kicker">{ch.kicker}</span>
              <h2 className="is-headline">{ch.title}</h2>
              <p>{ch.body}</p>

              {/* Chapter 1: editorial invite — subtle above-fold conversion signal */}
              {isFirst && (
                <button className="is-invite" type="button" onClick={onBuildGift}>
                  Build your gift <ArrowRight size={13} aria-hidden="true" />
                </button>
              )}

              {/* Chapter 4: primary gift-building CTA */}
              {isLast && (
                <button className="is-cta primary-action" type="button" onClick={onBuildGift}>
                  Build Your Gift <ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
