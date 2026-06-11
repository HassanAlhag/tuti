import { BadgePercent } from "lucide-react";
import { offerSections } from "../siteMap.js";
import { PageHero, FeatureGrid } from "./sitemapPageShared.jsx";

export function OffersPage({ promotions, getProduct, onNavigate }) {
  return (
    <main className="page-shell">
      <PageHero
        kicker="Offers"
        title="Offers, bundles, seasonal sale, and promo codes"
        text="A clean commercial area for campaigns without mixing offers into every catalog page."
      />
      <FeatureGrid items={offerSections} icon={BadgePercent} onNavigate={onNavigate} />
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
    </main>
  );
}
