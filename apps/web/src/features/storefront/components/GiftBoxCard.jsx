import { CheckCircle2, Clock, Gift, Heart, Plus, Star } from "lucide-react";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import { bayesianScore } from "@tuti/shared/utils/rating.js";
import { useAuthStore } from "@tuti/shared/store/authStore.js";
import { useWishlistStore } from "@tuti/shared/store/wishlistStore.js";

const OCCASION_LABELS = {
  birthday: "Birthday", anniversary: "Anniversary", eid: "Eid",
  ramadan: "Ramadan", wedding: "Wedding", corporate: "Corporate",
  graduation: "Graduation", valentine: "Valentine", baby_shower: "Baby Shower",
};

export function GiftVisual({ product }) {
  return (
    <div className="gift-visual" style={{ "--gift-color": product.color, "--gift-accent": product.accent }}>
      <div className="gift-box-body">
        <div className="gift-box-lid" />
        <div className="gift-ribbon-h" />
        <div className="gift-ribbon-v" />
        <Gift size={22} className="gift-icon" />
      </div>
    </div>
  );
}

export function GiftBoxCard({ product, shop, onAddToCart, onViewProduct }) {
  const { isAuthenticated } = useAuthStore();
  const { has, toggle } = useWishlistStore();
  const isWishlisted = has(product.id);

  const score = bayesianScore(product.rating, product.reviews);
  const saving = product.originalPrice ? product.originalPrice - product.price : 0;
  const stockLabel = product.stock > 5 ? "In stock" : product.stock > 0 ? "Limited availability" : "Out of stock";
  const occasionTags = (product.occasionTags || []).slice(0, 2);
  const includes = (product.includes || []).slice(0, 2);
  const sellerName = shop?.name || "Marketplace seller";
  const hasReviews = Number(product.reviews || 0) > 0;
  const summary = includes.length ? includes.join(" · ") : "Thoughtfully assembled for gifting and celebrations.";
  const imageAlt = `${product.name} by ${sellerName}`;

  function viewProduct() {
    onViewProduct?.(product.id);
  }

  return (
    <article className="gift-card">
      <div className="catalog-card-media-wrap">
        <button className="product-media-button catalog-card-media" onClick={viewProduct} type="button" aria-label={`View details for ${product.name}`}>
          {product.imagePath ? (
            <img className="catalog-card-image" src={product.imagePath} alt={imageAlt} loading="lazy" decoding="async" />
          ) : (
            <GiftVisual product={product} />
          )}
        </button>
        <div className="catalog-card-media-actions">
          {isAuthenticated() ? (
            <button
              aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
              aria-pressed={isWishlisted}
              className={isWishlisted ? "catalog-card-float-btn wishlist-btn saved" : "catalog-card-float-btn wishlist-btn"}
              onClick={() => toggle(product.id, product.name)}
              type="button"
            >
              <Heart size={17} fill={isWishlisted ? "currentColor" : "none"} />
            </button>
          ) : null}
          <button className="catalog-card-float-btn catalog-card-float-btn--primary" onClick={() => onAddToCart(product)} title="Add to cart" aria-label={`Add ${product.name} to cart`} type="button">
            <Plus size={19} />
          </button>
        </div>
        {hasReviews ? (
          <div className="catalog-card-rating-badge">
            <Star size={12} fill="currentColor" />
            <strong>{score}</strong>
          </div>
        ) : null}
        {saving > 0 && (
          <span className="gift-saving-badge">Save {formatCurrency(saving)}</span>
        )}
      </div>

      <div className="gift-card-body catalog-card-body">
        <div className="catalog-card-header">
          <span className="catalog-card-seller">{sellerName}</span>
          <span className="catalog-card-chip">Gift Box</span>
        </div>
        <h3 className="gift-card-name catalog-card-title">
          <button className="product-title-button catalog-card-title-button" onClick={viewProduct} type="button">
            {product.name}
          </button>
        </h3>
        <p className="catalog-card-summary">{summary}</p>

        {includes.length > 0 && (
          <ul className="gift-includes">
            {includes.map((item, i) => (
              <li key={i}>
                <CheckCircle2 size={12} />
                {item}
              </li>
            ))}
            {product.includes.length > includes.length && (
              <li className="gift-includes-more">+{product.includes.length - includes.length} more</li>
            )}
          </ul>
        )}

        {occasionTags.length > 0 && (
          <div className="cake-occasions catalog-card-tags">
            {occasionTags.map((tag) => (
              <span key={tag} className="occasion-tag occasion-tag-gold">
                {OCCASION_LABELS[tag] || tag}
              </span>
            ))}
          </div>
        )}

        <div className="gift-card-meta catalog-card-meta">
          {product.customMessageAvailable && (
            <span className="gift-meta-chip"><CheckCircle2 size={11} /> Custom message</span>
          )}
          {product.leadTimeDays > 0 && (
            <span className="gift-meta-chip">
              <Clock size={11} />
              {product.leadTimeDays === 1 ? "Next-day" : `${product.leadTimeDays}-day lead`}
            </span>
          )}
        </div>

        <div className="cake-card-footer catalog-card-footer">
          <div className="cake-price-block catalog-card-price">
            <strong className="gift-price">{formatCurrency(product.price)}</strong>
            {product.originalPrice > product.price && (
              <del>{formatCurrency(product.originalPrice)}</del>
            )}
            <span>{stockLabel}</span>
          </div>
          <button className="secondary-action compact catalog-card-view" onClick={viewProduct} type="button">
            View details
          </button>
        </div>
      </div>
    </article>
  );
}
