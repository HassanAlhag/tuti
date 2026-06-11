import { ShieldCheck, ShoppingBag, Star, Truck } from "lucide-react";
import heroImage from "../../../assets/perfume-hero.png";

export function HeroShowcase({
  eyebrow = "Emerging perfume shops",
  productCount,
  shopCount,
  title = "Tuti",
}) {
  return (
    <section
      className="hero-band premium-hero"
      style={{
        backgroundImage: `linear-gradient(90deg, rgba(16, 24, 32, 0.9), rgba(16, 24, 32, 0.48), rgba(16, 24, 32, 0.16)), url(${heroImage})`,
      }}
    >
      <div className="hero-content">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>
          A premium perfume marketplace for independent shops, verified client ratings, protected payouts, and boutique discoveries.
        </p>
        <div className="hero-stats">
          <span><strong>{productCount}</strong> curated perfumes</span>
          <span><strong>{shopCount}</strong> reviewed shops</span>
          <span><strong>5-7</strong> day payout reserve</span>
        </div>
        <div className="hero-actions">
          <a className="primary-action" href="#catalog">
            <ShoppingBag size={18} />
            Browse catalog
          </a>
          <a className="secondary-action" href="#new-releases">
            <Star size={18} />
            New releases
          </a>
        </div>
      </div>

      <div className="hero-proof">
        <article>
          <ShieldCheck size={18} />
          <strong>Verified reviews</strong>
          <span>Ratings weighted by purchase confidence.</span>
        </article>
        <article>
          <Truck size={18} />
          <strong>Protected seller payouts</strong>
          <span>Release after delivery and reserve checks.</span>
        </article>
      </div>
    </section>
  );
}
