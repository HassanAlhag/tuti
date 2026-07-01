import { Clock, Heart, Plus, ShoppingBag, Star } from "lucide-react";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import { bayesianScore } from "@tuti/shared/utils/rating.js";
import { useAuthStore } from "@tuti/shared/store/authStore.js";
import { useWishlistStore } from "@tuti/shared/store/wishlistStore.js";

const OCCASION_LABELS = {
  birthday:    "Birthday",
  anniversary: "Anniversary",
  eid:         "Eid",
  ramadan:     "Ramadan",
  wedding:     "Wedding",
  corporate:   "Corporate",
  graduation:  "Graduation",
  valentine:   "Valentine",
  baby_shower: "Baby Shower",
};

export function CakeVisual({ product }) {
  return (
    <div className="cake-visual" style={{ "--cake-color": product.color, "--cake-accent": product.accent }}>
      <div className="cake-tier tier-3" />
      <div className="cake-tier tier-2" />
      <div className="cake-tier tier-1" />
      <div className="cake-topper" />
    </div>
  );
}

export function CakeCard({ product, shop, onAddToCart, onViewProduct }) {
  const { isAuthenticated } = useAuthStore();
  const { has, toggle } = useWishlistStore();
  const isWishlisted = has(product.id);

  const score = bayesianScore(product.rating, product.reviews);
  const stockLabel = product.stock > 5 ? "In stock" : product.stock > 0 ? "Limited availability" : "Out of stock";
  const occasionTags = (product.occasionTags || []).slice(0, 2);
  const hasReviews = Number(product.reviews || 0) > 0;
  const sellerName = shop?.name || "Marketplace seller";
  const summary = product.flavors?.length > 0 ? product.flavors.slice(0, 2).join(" · ") : "Freshly prepared for celebrations and gifting.";
  const imageAlt = `${product.name} by ${sellerName}`;

  function viewProduct() {
    onViewProduct?.(product.id);
  }

  return (
    <article className="cake-card">
      <div className="catalog-card-media-wrap">
        <button className="product-media-button catalog-card-media" onClick={viewProduct} type="button" aria-label={`View details for ${product.name}`}>
          {product.imagePath ? (
            <img className="catalog-card-image" src={product.imagePath} alt={imageAlt} loading="lazy" decoding="async" />
          ) : (
            <CakeVisual product={product} />
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
      </div>

      <div className="cake-card-body catalog-card-body">
        <div className="catalog-card-header">
          <span className="catalog-card-seller">{sellerName}</span>
          <span className="catalog-card-chip">{product.cakeType || "Cake"}</span>
        </div>

        <h3 className="cake-card-name catalog-card-title">
          <button className="product-title-button catalog-card-title-button" onClick={viewProduct} type="button">
            {product.name}
          </button>
        </h3>

        <p className="catalog-card-summary cake-flavors">{summary}</p>

        <div className="cake-card-meta catalog-card-meta">
          {product.servings && (
            <span className="cake-meta-chip">
              <ShoppingBag size={12} />
              Serves {product.servings}
            </span>
          )}
          {product.leadTimeDays > 0 && (
            <span className="cake-meta-chip">
              <Clock size={12} />
              {product.leadTimeDays === 1 ? "Same-day" : `${product.leadTimeDays}-day lead`}
            </span>
          )}
        </div>

        {occasionTags.length > 0 && (
          <div className="cake-occasions catalog-card-tags">
            {occasionTags.map((tag) => (
              <span key={tag} className="occasion-tag">
                {OCCASION_LABELS[tag] || tag}
              </span>
            ))}
          </div>
        )}

        <div className="cake-card-footer catalog-card-footer">
          <div className="cake-price-block catalog-card-price">
            <strong>{formatCurrency(product.price)}</strong>
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
