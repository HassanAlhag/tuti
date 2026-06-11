import { CheckCircle2, Clock, Gift, Plus, Star } from "lucide-react";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import { bayesianScore } from "@tuti/shared/utils/rating.js";

const OCCASION_LABELS = {
  birthday: "Birthday", anniversary: "Anniversary", eid: "Eid",
  ramadan: "Ramadan", wedding: "Wedding", corporate: "Corporate",
  graduation: "Graduation", valentine: "Valentine", baby_shower: "Baby Shower",
};

function GiftVisual({ product }) {
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
      <button className="product-media-button catalog-card-media" onClick={viewProduct} type="button" aria-label={`View details for ${product.name}`}>
        {product.imagePath ? (
          <img className="catalog-card-image" src={product.imagePath} alt={imageAlt} loading="lazy" decoding="async" />
        ) : (
          <GiftVisual product={product} />
        )}
      </button>

      {saving > 0 && (
        <span className="gift-saving-badge">Save {formatCurrency(saving)}</span>
      )}

      <div className="gift-card-body catalog-card-body">
        <div className="catalog-card-header">
          <span className="catalog-card-seller">{sellerName}</span>
          <span className="catalog-card-chip">Gift set</span>
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

        {hasReviews ? (
          <div className="cake-card-rating catalog-card-rating">
            <Star size={14} fill="currentColor" />
            <strong>{score}</strong>
            <span>{product.reviews} reviews</span>
          </div>
        ) : null}

        <div className="cake-card-footer catalog-card-footer">
          <div className="cake-price-block catalog-card-price">
            <strong className="gift-price">{formatCurrency(product.price)}</strong>
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
