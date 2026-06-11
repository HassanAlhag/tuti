import { ArrowRight, Gift, ShieldCheck, Store } from "lucide-react";
import completeGiftImage from "../../assets/home-ch4-complete.png";
import { ImmersiveStory } from "../immersive/ImmersiveStory.jsx";
import { AdaptiveBoutique } from "../homepage/AdaptiveBoutique.jsx";
import { AdaptiveProductEdit } from "../homepage/AdaptiveProductEdit.jsx";
import "../homepage/homepage.css";
import cakeCategoryImage from "../../assets/category-cakes.jpg";
import perfumeImage from "../../assets/category-perfumes.jpg";
import giftSetImage from "../../assets/category-gift-sets.jpg";

const CATEGORY_ENTRY_POINTS = [
  {
    key: "perfume",
    title: "Perfumes",
    eyebrow: "Boutique fragrances",
    description: "Oud, amber, musk, floral and fresh signatures from independent houses.",
    cta: "Explore",
    image: perfumeImage,
    feature: true,
  },
  {
    key: "cake",
    title: "Cakes & Desserts",
    eyebrow: "Made for the moment",
    description: "Artisan cakes, sweets and desserts prepared for every celebration.",
    cta: "Explore",
    image: cakeCategoryImage,
  },
  {
    key: "gift_box",
    title: "Gift Sets",
    eyebrow: "Curated together",
    description: "Thoughtful combinations, ready to give.",
    cta: "Explore",
    image: giftSetImage,
  },
  {
    key: "build_box",
    title: "Build a Box",
    eyebrow: "Make it personal",
    description: "Choose a scent, add something sweet and write your message.",
    cta: "Explore",
    image: completeGiftImage,
    feature: true,
  },
];

const DISCOVERY_LINKS = [
  {
    key: "collections",
    label: "Browse collections",
    description: "Curated edits for scent families, gifting moods, and seasonal discovery.",
  },
  {
    key: "finder",
    label: "Find a scent",
    description: "Use the guided finder when you want a quicker path to the right fragrance.",
  },
  {
    key: "journal",
    label: "Read the journal",
    description: "Explore gifting ideas, fragrance notes, and inspiration from the Tuti world.",
  },
];

function CategoryShowcase({ entries, onSelectCategory, onBuildGift, onGoToCollections, onGoToFragranceFinder, onGoToJournal }) {
  function handleDiscoveryLink(linkKey) {
    if (linkKey === "collections") {
      onGoToCollections?.();
      return;
    }
    if (linkKey === "finder") {
      onGoToFragranceFinder?.();
      return;
    }
    if (linkKey === "journal") {
      onGoToJournal?.();
    }
  }

  return (
    <section className="home-section home-categories-section" aria-label="Shop by category">
      <div className="category-showcase-head">
        <div className="category-showcase-copy">
          <span className="eyebrow">Choose how you want to shop</span>
          <h2>Start with the path that suits the gift.</h2>
          <p>
            Shop by fragrance, celebration, or ready-made gift. The homepage should guide the decision, not make it harder.
          </p>
        </div>

        <div className="category-showcase-links" aria-label="Additional discovery paths">
          {DISCOVERY_LINKS.map((link) => (
            <button
              key={link.key}
              className="category-discovery-link"
              type="button"
              onClick={() => handleDiscoveryLink(link.key)}
            >
              <span className="category-discovery-link-label">
                {link.label} <ArrowRight size={13} />
              </span>
              <span className="category-discovery-link-desc">{link.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="category-showcase">
        {entries.map((entry) => (
          <button
            key={entry.key}
            className={[
              "category-card-link",
              `category-card-link--${entry.key.replace(/_/g, "-")}`,
              entry.feature ? "category-card-link--feature" : "",
              entry.key === "cake" ? "category-card-link--warm" : "",
              entry.key === "gift_box" ? "category-card-link--gift" : "",
              entry.key === "build_box" ? "category-card-link--build" : "",
            ].filter(Boolean).join(" ")}
            onClick={() => {
              if (entry.key === "build_box") onBuildGift?.();
              else onSelectCategory?.(entry.key);
            }}
            style={{ "--category-image": `url(${entry.image})` }}
            type="button"
          >
            <span className="category-card-kicker">{entry.eyebrow}</span>
            <h3>{entry.title}</h3>
            <p>{entry.description}</p>
            <span className="category-card-cta">
              {entry.cta} <ArrowRight size={14} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

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

        {/* Act 2 — Category Worlds */}
        <CategoryShowcase
          entries={CATEGORY_ENTRY_POINTS}
          onBuildGift={goToBuildBox || goToGifting}
          onGoToCollections={goToCollections}
          onGoToFragranceFinder={goToFragranceFinder}
          onGoToJournal={goToJournal}
          onSelectCategory={goToShop}
        />

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
