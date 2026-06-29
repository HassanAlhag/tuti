import { Gift, Lock, ShieldCheck, Store } from "lucide-react";
import { ImmersiveStory } from "../immersive/ImmersiveStory.jsx";
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
      {/* Act 1 — The Gift Journey (four pinned immersive scenes) */}
      <ImmersiveStory onBuildGift={goToBuildBox} />

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
