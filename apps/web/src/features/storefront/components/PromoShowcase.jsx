import { ChevronRight, Sparkles } from "lucide-react";
import { BottleArt } from "@tuti/shared/components/BottleArt.jsx";
import { formatCurrency } from "@tuti/shared/utils/money.js";

export function PromoShowcase({ getProduct, onPromoClick, promotions }) {
  return (
    <section className="promo-showcase" aria-label="Promotions">
      {promotions.map((promo, index) => {
        const promoProducts = promo.productIds.map(getProduct).filter(Boolean);
        const lead = promoProducts[0];

        return (
          <article className={index === 0 ? "promo-card hero-promo" : "promo-card"} key={promo.id}>
            <div>
              <span className="promo-badge"><Sparkles size={15} /> {promo.badge}</span>
              <h2>{promo.title}</h2>
              <p>{promo.subtitle}</p>
              <button className="secondary-action compact" onClick={() => onPromoClick?.(promo)} type="button">
                {promo.cta}
                <ChevronRight size={16} />
              </button>
            </div>
            {lead ? (
              <div className="promo-product">
                <BottleArt product={lead} compact />
                <strong>{lead.name}</strong>
                <span>{formatCurrency(lead.price)}</span>
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
