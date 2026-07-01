import { ArrowRight, CakeSlice, Gift, Lock, Package, ShieldCheck, SprayCan, Store, Truck, Wand2 } from "lucide-react";
import { GiftingShortcuts } from "../homepage/GiftingShortcuts.jsx";
import { PathSelector } from "../homepage/PathSelector.jsx";
import { GiftBuilderPreview } from "../homepage/GiftBuilderPreview.jsx";
import { AdaptiveBoutique } from "../homepage/AdaptiveBoutique.jsx";
import { AdaptiveProductEdit } from "../homepage/AdaptiveProductEdit.jsx";
import { OccasionJourney } from "../homepage/OccasionJourney.jsx";
import { EditorialDiscovery } from "../homepage/EditorialDiscovery.jsx";
import { FinalCTA } from "../homepage/FinalCTA.jsx";
import "../homepage/homepage.css";

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    title: "Every seller is reviewed",
    text: "Boutiques pass a quality check before going live.",
  },
  {
    icon: Gift,
    title: "Made for gifting",
    text: "Perfumes, cakes and messages, brought together with care.",
  },
  {
    icon: Store,
    title: "UAE-first delivery",
    text: "Local sellers and delivery options across the UAE.",
  },
  {
    icon: Lock,
    title: "Secure checkout",
    text: "COD checkout with transparent order confirmation.",
  },
];

function LiquidGlassHero({ goToBuildBox, goToFragranceFinder, goToShop, goToShops }) {
  return (
    <section className="liquid-home-hero is-story" aria-labelledby="liquid-home-hero-title">
      <div className="liquid-ambient liquid-ambient--cyan" aria-hidden="true" />
      <div className="liquid-ambient liquid-ambient--cherry" aria-hidden="true" />
      <div className="liquid-ambient liquid-ambient--gold" aria-hidden="true" />

      <div className="liquid-hero-copy">
        <span className="liquid-eyebrow">
          <i aria-hidden="true" />
          AI gift concierge for perfumes and patisserie
        </span>
        <h1 id="liquid-home-hero-title">
          Gifts that feel <span>chosen.</span>
        </h1>
        <p>
          Match luxury fragrance, elegant cakes, and polished gift boxes in one calm marketplace built for same-day moments, boutique sellers, and thoughtful recommendations.
        </p>

        <form
          className="liquid-command-bar"
          aria-label="Find gift ideas"
          onSubmit={(event) => {
            event.preventDefault();
            goToFragranceFinder?.();
          }}
        >
          <span className="liquid-command-ai" aria-hidden="true">AI</span>
          <span className="liquid-command-copy">
            <strong>Find a gift for an anniversary tonight, under AED 450.</strong>
            <small>Scanning oud, floral cakes, pistachio patisserie, and boutique availability.</small>
          </span>
          <button type="submit">Generate picks</button>
          <span className="liquid-command-scan" aria-hidden="true" />
        </form>

        <div className="liquid-hero-actions">
          <button className="liquid-primary" type="button" onClick={goToBuildBox}>
            Build a premium box <ArrowRight size={17} aria-hidden="true" />
          </button>
          <button className="liquid-secondary" type="button" onClick={() => goToShop?.("gift_box")}>
            Explore same-day gifts
          </button>
        </div>

        <div className="liquid-hero-chips" aria-label="Tuti trust cues">
          <span className="liquid-chip liquid-chip--ai">Smart pairing</span>
          <span className="liquid-chip">Same-day UAE delivery</span>
          <span className="liquid-chip">Boutique verified</span>
          <span className="liquid-chip">COD-ready preview</span>
        </div>
      </div>

      <div className="liquid-product-stage" aria-label="Perfume cake and gift composition">
        <div className="liquid-stage-light" aria-hidden="true" />
        <div className="liquid-stage-ring" aria-hidden="true" />
        <div className="liquid-stage-note">
          <strong>Curated gift stage</strong>
          Glass fragrance, patisserie texture, and matte packaging share one premium visual language.
        </div>
        <div className="liquid-composition" aria-hidden="true">
          <div className="liquid-stage-shadow" />
          <div className="liquid-gift">
            <span className="liquid-gift-box" />
            <span className="liquid-gift-lid" />
            <span className="liquid-gift-ribbon-v" />
            <span className="liquid-gift-ribbon-h" />
            <span className="liquid-gift-seal">T</span>
          </div>
          <div className="liquid-perfume">
            <span className="liquid-perfume-cap" />
            <span className="liquid-perfume-neck" />
            <span className="liquid-perfume-bottle" />
            <span className="liquid-perfume-label">NOIR</span>
          </div>
          <div className="liquid-cake">
            <span className="liquid-cake-plate" />
            <span className="liquid-cake-body" />
            <span className="liquid-cake-cream" />
          </div>
        </div>
        <div className="liquid-metrics" aria-label="Marketplace highlights">
          <span><strong>4.9</strong> Boutique rating</span>
          <span><strong>28m</strong> AI shortlist</span>
          <span><strong>120+</strong> Pairings</span>
        </div>
      </div>

      <div className="liquid-action-dock" aria-label="Quick gift actions">
        <button type="button" onClick={() => goToShop?.("perfume")}><SprayCan size={20} aria-hidden="true" />Perfumes</button>
        <button type="button" onClick={() => goToShop?.("cake")}><CakeSlice size={20} aria-hidden="true" />Cakes</button>
        <button type="button" onClick={() => goToShop?.("gift_box")}><Package size={20} aria-hidden="true" />Gift Boxes</button>
        <button type="button" onClick={() => goToShop?.("all")}><Truck size={20} aria-hidden="true" />Same Day</button>
        <button type="button" onClick={goToFragranceFinder}><Wand2 size={20} aria-hidden="true" />AI Finder</button>
        <button type="button" onClick={goToShops}><Store size={20} aria-hidden="true" />Boutiques</button>
      </div>
    </section>
  );
}

function TrustClosing() {
  return (
    <section className="trust-closing" aria-labelledby="trust-closing-heading">
      <div className="trust-closing-inner">
        <div className="trust-closing-head">
          <p className="trust-closing-label">Why Tuti</p>
          <h2 id="trust-closing-heading">Gifting with confidence.</h2>
          <p>
            Thoughtful curation, reliable boutiques, and customer-safe gifting language all the way through the experience.
          </p>
        </div>
        <div className="trust-grid">
          {TRUST_ITEMS.map(({ icon: Icon, title, text }) => (
            <div className="trust-item" key={title}>
              <span className="trust-icon-circle"><Icon size={20} aria-hidden="true" /></span>
              <strong>{title}</strong>
              <span>{text}</span>
            </div>
          ))}
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
  goToAccount,
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
      <LiquidGlassHero
        goToBuildBox={goToBuildBox}
        goToFragranceFinder={goToFragranceFinder}
        goToShop={goToShop}
        goToShops={goToShops}
      />

      <div className="home-content">

        {/* Act 2 — Smart Gifting Shortcuts launcher */}
        <GiftingShortcuts
          onFindGift={goToGifting}
          onFindScent={goToFragranceFinder}
          onBuildBox={goToBuildBox}
          onShopOccasion={() => goToShop("all")}
          onExploreBoutiques={goToShops}
          onTrackOrder={goToAccount}
        />

        {/* Act 3 — Path Selector */}
        <PathSelector goToShop={goToShop} goToBuildBox={goToBuildBox} />

        {/* Act 4 — Gift Builder Preview */}
        <GiftBuilderPreview
          onBuildGift={goToBuildBox}
          onExploreGiftSets={() => goToShop("gift_box")}
        />

        {/* Act 5 — Tuti Edit (Luxury Picks, adaptive by count) */}
        <AdaptiveProductEdit
          placementKey="luxury_picks"
          eyebrow="Selected by Tuti"
          sectionTitle="Luxury picks for meaningful moments."
          subtitle="A considered edit of fragrance, gifting and celebration essentials."
          sectionClassName="featured-product-rail--luxury-picks"
          onViewProduct={goToProduct}
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

        {/* Act 7 — Featured Boutique (adaptive by count) */}
        <AdaptiveBoutique
          onViewSeller={goToSellerBrand}
          onExploreShops={goToShops}
        />

        {/* Act 8 — Occasion Discovery (birthday → cake, eid → perfume, wedding → gift_box) */}
        <OccasionJourney
          onShopOccasion={(slug) => {
            const cats = { birthday: "cake", eid: "perfume", wedding: "gift_box" };
            goToShop(cats[slug] || "all");
          }}
        />

        {/* Act 9 — Editorial Discovery (journal, gifting, boutiques, fragrance finder, sell) */}
        <EditorialDiscovery
          onGoToGifting={goToGifting}
          onGoToFragranceFinder={goToFragranceFinder}
          onGoToShops={goToShops}
          onGoToJournal={goToJournal}
          onGoToSell={goToSell}
        />

        {/* Act 10 — Trust / Service Promise */}
        <TrustClosing />

        {/* Act 11 — Final CTA / Closing */}
        <FinalCTA
          onBuildGift={goToBuildBox}
          onExploreGifts={() => goToShop("gift_box")}
        />
      </div>
    </main>
  );
}
