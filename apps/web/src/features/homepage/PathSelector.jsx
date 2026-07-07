import { ArrowRight } from "lucide-react";
import cakeCategoryImage from "../../assets/category-cakes.jpg";
import completeGiftImage from "../../assets/home-ch4-complete.png";
import giftSetImage from "../../assets/category-gift-sets.jpg";
import perfumeImage from "../../assets/category-perfumes.jpg";

/* D1.2 — Path Selector. Pure four-path entry selector.
   Discovery links removed per D0.3 §2 (deferred to later sections).
   CSS: path- prefix in storefront.css canonical block. */

const PATH_ENTRIES = [
  {
    key: "perfume",
    title: "Perfumes",
    eyebrow: "Boutique fragrances",
    description: "Oud, amber, musk, floral and fresh signatures from independent houses.",
    image: perfumeImage,
    feature: true,
  },
  {
    key: "cake",
    title: "Cakes & Desserts",
    eyebrow: "Made for the moment",
    description: "Artisan cakes, sweets and desserts prepared for every celebration.",
    image: cakeCategoryImage,
  },
  {
    key: "gift_box",
    title: "Gift Boxes",
    eyebrow: "Curated together",
    description: "Thoughtful combinations, ready to give.",
    image: giftSetImage,
  },
  {
    key: "build_box",
    title: "Build a Gift",
    eyebrow: "Make it personal",
    description: "Choose a perfume and sweet from one boutique and write your message.",
    image: completeGiftImage,
    feature: true,
  },
];

export function PathSelector({ goToShop, goToBuildBox }) {
  function handleSelect(key) {
    if (key === "build_box") goToBuildBox?.();
    else goToShop?.(key);
  }

  return (
    <section className="path-selector home-section" aria-label="Choose your path">
      <div className="path-section-head">
        <span className="eyebrow">Discover your path</span>
        <h2>Start with the path that suits the gift.</h2>
        <p>
          Shop by fragrance, celebration, or ready-made gift. The path you choose shapes the experience.
        </p>
      </div>

      <div className="path-grid">
        {PATH_ENTRIES.map((entry) => (
          <button
            key={entry.key}
            className={[
              "path-card-link",
              `path-card-link--${entry.key.replace(/_/g, "-")}`,
              entry.feature ? "path-card-link--feature" : "",
              entry.key === "cake" ? "path-card-link--warm" : "",
              entry.key === "gift_box" ? "path-card-link--gift" : "",
              entry.key === "build_box" ? "path-card-link--build" : "",
            ].filter(Boolean).join(" ")}
            type="button"
            onClick={() => handleSelect(entry.key)}
            style={{ "--path-image": `url(${entry.image})` }}
          >
            <span className="path-card-kicker">{entry.eyebrow}</span>
            <h3>{entry.title}</h3>
            <p>{entry.description}</p>
            <span className="path-card-cta">
              Explore <ArrowRight size={14} aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
