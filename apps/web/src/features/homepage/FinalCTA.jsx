import { ArrowRight } from "lucide-react";

export function FinalCTA({ onBuildGift, onExploreGifts }) {
  return (
    <section className="final-cta" aria-labelledby="final-cta-heading">
      <div className="final-cta-inner">
        <span className="final-cta-rule" aria-hidden="true" />
        <span className="eyebrow final-cta-eyebrow">Ready to gift?</span>
        <h2 id="final-cta-heading">Build something they'll remember.</h2>
        <p className="final-cta-sub">
          A perfume, a cake and a personal message — gifted together in one box.
        </p>
        <div className="final-cta-actions">
          <button
            className="final-cta-primary"
            type="button"
            onClick={onBuildGift}
          >
            Start building a gift <ArrowRight size={16} aria-hidden="true" />
          </button>
          <button
            className="final-cta-secondary"
            type="button"
            onClick={onExploreGifts}
          >
            Explore gift sets
          </button>
        </div>
      </div>
    </section>
  );
}
