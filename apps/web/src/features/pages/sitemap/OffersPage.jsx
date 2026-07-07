import { BadgePercent, ShoppingBag } from "lucide-react";
import { offerSections } from "../siteMap.js";
import { PageHero, FeatureGrid } from "./sitemapPageShared.jsx";
import { useSeoMeta } from "@tuti/shared/hooks/useSeoMeta.js";

export function OffersPage({ promotions, getProduct, onNavigate }) {
  useSeoMeta({
    title: "Offers & Promotions — Perfumes, Curated Sets & Sale",
    description: "Limited-time offers, curated sets, seasonal sales, and promo codes on luxury perfumes, cakes, and gift boxes.",
    canonical: "https://tuti.ae/offers",
  });
  return (
    <main className="page-shell">
      <PageHero
        kicker="Offers"
        title="Offers, curated sets, seasonal sale, and promo codes"
        text="A clean commercial area for campaigns without mixing offers into every catalog page."
      />
      <FeatureGrid items={offerSections} icon={BadgePercent} onNavigate={onNavigate} />
      {promotions.length > 0 ? (
        <section className="offer-list">
          {promotions.map((promo) => (
            <article className="offer-row" key={promo.id}>
              <span>{promo.badge}</span>
              <div>
                <h2>{promo.title}</h2>
                <p>{promo.subtitle}</p>
                <small>{promo.productIds.map(getProduct).filter(Boolean).map((product) => product.name).join(" · ")}</small>
              </div>
              <button className="secondary-action compact" onClick={() => onNavigate("/shop")} type="button">
                {promo.cta}
              </button>
            </article>
          ))}
        </section>
      ) : (
        <div className="offer-empty">
          <BadgePercent size={28} aria-hidden="true" />
          <p>No active offers right now. Check back soon, or browse the full shop.</p>
          <button className="primary-action" onClick={() => onNavigate("/shop")} type="button">
            <ShoppingBag size={17} aria-hidden="true" />
            Go to Shop
          </button>
        </div>
      )}
    </main>
  );
}
