import { ArrowRight } from "lucide-react";

/* D1.3 — Gift Builder Preview. Four-step educational section explaining the Build a Gift flow.
   Positioned after D1.2 Path Selector per D0.3 §3. CSS: gift-preview- prefix in storefront.css.
   Primary CTA lives inside the head (visible before steps). Secondary CTA follows the steps. */

const GIFT_STEPS = [
  {
    num: "01",
    title: "Choose a scent",
    body: "Pick a perfume from independent boutique sellers — oud, amber, musk, floral and more.",
  },
  {
    num: "02",
    title: "Add something sweet",
    body: "Choose eligible add-ons and finishing touches from the same boutique.",
  },
  {
    num: "03",
    title: "Personalise it",
    body: "Write your message and choose how the gift is presented.",
  },
  {
    num: "04",
    title: "Gift it beautifully",
    body: "One boutique prepares the customized gift — ready for the moment.",
  },
];

export function GiftBuilderPreview({ onBuildGift, onExploreGiftSets }) {
  return (
    <section className="gift-preview home-section" aria-labelledby="gift-preview-title">
      <div className="gift-preview-head">
        <span className="eyebrow">Only at Tuti</span>
        <h2 id="gift-preview-title">Build a gift they will remember.</h2>
        <p>Four thoughtful steps. One complete gift, beautifully delivered.</p>
        <div className="gift-preview-primary-action">
          <button className="primary-action" type="button" onClick={onBuildGift}>
            Start building <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <ol className="gift-preview-steps" aria-label="How Build a Gift works">
        {GIFT_STEPS.map((step) => (
          <li key={step.num} className="gift-preview-step">
            <span className="gift-preview-step-num" aria-hidden="true">{step.num}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="gift-preview-secondary-action">
        <button
          className="ghost-action gift-preview-secondary"
          type="button"
          onClick={onExploreGiftSets}
        >
          Explore gift boxes
        </button>
      </div>
    </section>
  );
}
