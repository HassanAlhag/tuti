import { Clock, Plus, ShoppingBag, Star } from "lucide-react";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import { bayesianScore } from "@tuti/shared/utils/rating.js";

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

function CakeVisual({ product }) {
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
      <button className="product-media-button catalog-card-media" onClick={viewProduct} type="button" aria-label={`View details for ${product.name}`}>
        {product.imagePath ? (
          <img className="catalog-card-image" src={product.imagePath} alt={imageAlt} loading="lazy" decoding="async" />
        ) : (
          <CakeVisual product={product} />
        )}
      </button>

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

        {hasReviews ? (
          <div className="cake-card-rating catalog-card-rating">
            <Star size={14} fill="currentColor" />
            <strong>{score}</strong>
            <span>{product.reviews} reviews</span>
          </div>
        ) : null}

        <div className="cake-card-footer catalog-card-footer">
          <div className="cake-price-block catalog-card-price">
            <strong>{formatCurrency(product.price)}</strong>
            {product.originalPrice > product.price && (
              <del>{formatCurrency(product.originalPrice)}</del>
            )}
            <span>{stockLabel}</span>
          </div>
          <div className="catalog-card-actions">
            <button className="secondary-action compact catalog-card-view" onClick={viewProduct} type="button">
              View details
            </button>
            <button
              className="icon-button primary cake-add-btn"
              onClick={() => onAddToCart(product)}
              title="Add to cart"
              aria-label={`Add ${product.name} to cart`}
              type="button"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
