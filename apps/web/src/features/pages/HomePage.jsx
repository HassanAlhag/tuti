import { ArrowRight, Gift, ShieldCheck, Store } from "lucide-react";
import completeGiftImage from "../../assets/home-ch4-complete.png";
import { ImmersiveStory } from "../immersive/ImmersiveStory.jsx";
import { PathSelector } from "../homepage/PathSelector.jsx";
import { AdaptiveBoutique } from "../homepage/AdaptiveBoutique.jsx";
import { AdaptiveProductEdit } from "../homepage/AdaptiveProductEdit.jsx";
import "../homepage/homepage.css";

function BuildBoxFeature({ onBuildGift, onExploreGiftSets }) {
  return (
    <section className="home-section build-feature" aria-labelledby="build-feature-title">
      <div className="build-feature-copy">
        <span className="eyebrow">Only at Tuti</span>
        <h2 id="build-feature-title">Build a gift they will remember.</h2>
        <p>
          Choose a perfume. Add a cake or dessert. Include your message. We bring it together in one considered gift.
        </p>
        <div className="build-feature-actions">
          <button className="primary-action" type="button" onClick={onBuildGift}>
            Start building <ArrowRight size={16} />
          </button>
          <button className="ghost-action build-feature-secondary" onClick={onExploreGiftSets} type="button">
            Explore gift sets
          </button>
        </div>
        <div className="build-feature-points" aria-label="Build a box benefits">
          <span>One boutique</span>
          <span>One delivery</span>
          <span>One memorable gift</span>
        </div>
      </div>

      <div className="build-feature-media" aria-hidden="true">
        <img alt="" src={completeGiftImage} />
      </div>
    </section>
  );
}

function TrustClosing() {
  return (
    <section className="trust-closing" aria-labelledby="trust-title">
      <div className="trust-closing-inner">
        <div className="trust-closing-head">
          <p className="trust-closing-label" id="trust-title">Why Tuti</p>
          <h2>Gifting with confidence.</h2>
          <p>
            Thoughtful curation, reliable boutiques, and customer-safe gifting language all the way through the experience.
          </p>
        </div>
        <div className="trust-strip">
          <article className="trust-fact">
            <ShieldCheck size={20} aria-hidden="true" />
            <div>
              <strong>Every seller is reviewed</strong>
              <span>Boutiques pass a quality check before going live.</span>
            </div>
          </article>
          <div className="trust-divider" aria-hidden="true" />
          <article className="trust-fact">
            <Gift size={20} aria-hidden="true" />
            <div>
              <strong>Made for gifting</strong>
              <span>Perfumes, cakes and messages, brought together with care.</span>
            </div>
          </article>
          <div className="trust-divider" aria-hidden="true" />
          <article className="trust-fact">
            <Store size={20} aria-hidden="true" />
            <div>
              <strong>UAE-first delivery</strong>
              <span>Local sellers and delivery options across the UAE.</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

export function HomePage({
  collections,
  getProduct,
  getShop,
  goToAbout,
  goToBuildBox,
  goToCollections,
  goToFragranceFinder,
  goToGifting,
  goToJournal,
  goToProduct,
  goToSellerBrand,
  goToShop,
  goToShops,
  goToSell,
  onAddToCart,
  products,
  promotions,
  shops,
  topPerfumes,
  topShops,
}) {
  return (
    <main className="home-page">
      {/* Act 1 — The Gift Journey (four pinned immersive scenes) */}
      <ImmersiveStory onBuildGift={goToBuildBox} />

      <div className="home-content">

        {/* Transition — editorial chapter break */}
        <section className="home-transition-intro home-section" aria-labelledby="discover-tuti-title">
          <span className="eyebrow">Discover Tuti</span>
          <h2 id="discover-tuti-title">Thoughtful gifting, made personal.</h2>
          <p>
            Explore boutique perfumes, artisan cakes and desserts, curated gift sets, and the Tuti Build a Box experience.
          </p>
          <p className="home-transition-intro-ar" lang="ar" dir="auto">هدايا مدروسة، مصممة بطريقتك.</p>
        </section>

        {/* Act 2 — Path Selector */}
        <PathSelector goToShop={goToShop} goToBuildBox={goToBuildBox} />

        {/* Act 3 — Featured Boutique (adaptive by count) */}
        <AdaptiveBoutique
          onViewSeller={goToSellerBrand}
          onExploreShops={goToShops}
        />

        {/* Act 4 — Tuti Edit (Luxury Picks, adaptive by count) */}
        <AdaptiveProductEdit
          placementKey="luxury_picks"
          eyebrow="Selected by Tuti"
          sectionTitle="Luxury picks for meaningful moments."
          subtitle="A considered edit of fragrance, gifting and celebration essentials."
          sectionClassName="featured-product-rail--luxury-picks"
          onViewProduct={goToProduct}
        />

        {/* Act 5 — Build Something Personal */}
        <BuildBoxFeature
          onBuildGift={goToBuildBox}
          onExploreGiftSets={() => goToShop("gift_box")}
        />

        {/* Act 6 — New at Tuti (New Arrivals, adaptive by count) */}
        <AdaptiveProductEdit
          placementKey="new_arrivals"
          eyebrow="Just landed"
          sectionTitle="New arrivals from local boutiques."
          subtitle="Fresh discoveries, new gift ideas and recently added favourites."
          sectionClassName="featured-product-rail--new-arrivals"
          onViewProduct={goToProduct}
        />

        {/* Act 7 — Trust and Footer */}
        <TrustClosing />
      </div>
    </main>
  );
}
