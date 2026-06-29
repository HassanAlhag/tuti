import { Heart, Plus, Star } from "lucide-react";
import { BottleArt } from "@tuti/shared/components/BottleArt.jsx";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import { bayesianScore } from "@tuti/shared/utils/rating.js";
import { useAuthStore } from "@tuti/shared/store/authStore.js";
import { useWishlistStore } from "@tuti/shared/store/wishlistStore.js";

export function ProductCard({ product, shop, onAddToCart, onRateProduct, onViewProduct }) {
  const { isAuthenticated } = useAuthStore();
  const { has, toggle } = useWishlistStore();
  const isWishlisted = has(product.id);

  const score = bayesianScore(product.rating, product.reviews);
  const availabilityLabel = product.stock > 5 ? "In stock" : product.stock > 0 ? "Limited availability" : "Out of stock";
  const leadTimeLabel = product.leadTimeDays ? `${product.leadTimeDays}-day lead` : null;
  const notes = (product.notes || []).slice(0, 2);
  const summary = notes.length ? notes.join(" · ") : (product.description || "");
  const chipLabel = product.family || product.category || "Perfume";
  const sellerName = shop?.name || "Marketplace seller";
  const hasReviews = Number(product.reviews || 0) > 0;
  const imageAlt = `${product.name} by ${sellerName}`;

  function viewProduct() {
    if (onViewProduct) {
      onViewProduct(product.id);
      return;
    }
    onRateProduct?.(product.id);
  }
  return (
    <article className="product-card">
      <div className="catalog-card-media-wrap">
        <button className="product-media-button catalog-card-media" onClick={viewProduct} type="button" aria-label={`View details for ${product.name}`}>
          {product.imagePath ? (
            <img className="catalog-card-image" src={product.imagePath} alt={imageAlt} loading="lazy" decoding="async" />
          ) : (
            <BottleArt product={product} />
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
      <div className="product-body catalog-card-body">
        <div className="catalog-card-header">
          <span className="catalog-card-seller">{sellerName}</span>
          <span className="catalog-card-chip">{chipLabel}</span>
        </div>
        <h3 className="catalog-card-title">
          <button className="product-title-button catalog-card-title-button" onClick={viewProduct} type="button">
            {product.name}
          </button>
        </h3>
        {summary ? <p className="catalog-card-summary">{summary}</p> : null}
        <div className="catalog-card-meta">
          <span>{availabilityLabel}</span>
          {leadTimeLabel ? <span>{leadTimeLabel}</span> : null}
          {product.size ? <span>{product.size}</span> : null}
        </div>
        <div className="product-footer catalog-card-footer">
          <div className="catalog-card-price">
            <strong>{formatCurrency(product.price)}</strong>
            {product.originalPrice ? <del>{formatCurrency(product.originalPrice)}</del> : null}
          </div>
          <button className="secondary-action compact catalog-card-view" onClick={viewProduct} type="button">
            View details
          </button>
        </div>
      </div>
    </article>
  );
}
