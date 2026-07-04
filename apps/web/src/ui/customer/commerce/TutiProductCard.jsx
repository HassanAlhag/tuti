import { Heart, Plus, ShoppingBag } from "lucide-react";
import { TutiBadge, TutiButton, TutiCard, TutiMediaStage } from "../primitives/index.js";
import { TutiPrice } from "./TutiPrice.jsx";
import {
  getProductCategory,
  getProductCompareAtPrice,
  getProductId,
  getProductImage,
  getProductName,
  getProductPrice,
  getProductSummary,
  getProductTags,
  getProductTypeLabel,
  getShopName,
} from "./commerceUtils.js";

const cx = (...parts) => parts.filter(Boolean).join(" ");

export function TutiProductCard({
  product = {},
  shop,
  variant = "catalog",
  showAddButton = true,
  showViewButton = true,
  showWishlist = false,
  selected = false,
  disabled = false,
  onAddToCart,
  onViewProduct,
  onToggleWishlist,
  href,
  className = "",
}) {
  const productId = getProductId(product);
  const title = getProductName(product);
  const category = getProductCategory(product);
  const image = getProductImage(product);
  const price = getProductPrice(product);
  const compareAtPrice = getProductCompareAtPrice(product);
  const shopName = getShopName(product, shop);
  const typeLabel = getProductTypeLabel(product);
  const tags = getProductTags(product, variant === "compact" ? 1 : 3);
  const summary = variant === "compact" ? "" : getProductSummary(product);
  const unavailable = disabled || product.stock === 0;

  function viewProduct(event) {
    if (unavailable && !href) return;
    event?.preventDefault();
    onViewProduct?.(productId, product);
  }

  function addToCart(event) {
    event?.preventDefault();
    event?.stopPropagation();
    if (unavailable) return;
    onAddToCart?.(product);
  }

  function toggleWishlist(event) {
    event?.preventDefault();
    event?.stopPropagation();
    if (disabled) return;
    onToggleWishlist?.(product);
  }

  return (
    <TutiCard
      as="article"
      variant="commerce"
      padding="none"
      interactive={!disabled}
      className={cx(
        "tuti-product-card",
        `tuti-product-card--${variant}`,
        selected && "is-selected",
        unavailable && "is-disabled",
        className
      )}
    >
      <div className="tuti-product-card__media-wrap">
        <TutiMediaStage
          category={category}
          image={image}
          alt={image ? title : ""}
          size={variant === "compact" ? "sm" : "md"}
          className="tuti-product-card__media"
        />
        <div className="tuti-product-card__media-actions">
          {showWishlist ? (
            <button
              type="button"
              className="tuti-product-card__icon-button"
              onClick={toggleWishlist}
              disabled={disabled}
              aria-label={`Save ${title}`}
            >
              <Heart size={16} aria-hidden="true" />
            </button>
          ) : null}
          {showAddButton ? (
            <button
              type="button"
              className="tuti-product-card__icon-button tuti-product-card__icon-button--primary"
              onClick={addToCart}
              disabled={unavailable}
              aria-label={`Add ${title} to cart`}
            >
              <Plus size={17} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {selected ? <TutiBadge tone="cyan" className="tuti-product-card__selected">Selected</TutiBadge> : null}
      </div>

      <div className="tuti-product-card__body">
        <div className="tuti-product-card__meta-row">
          <span>{shopName}</span>
          <TutiBadge tone="neutral">{typeLabel}</TutiBadge>
        </div>
        <h3 className="tuti-product-card__title">
          {href ? (
            <a href={href} onClick={onViewProduct ? viewProduct : undefined}>{title}</a>
          ) : (
            <button type="button" onClick={viewProduct} disabled={disabled}>
              {title}
            </button>
          )}
        </h3>
        {summary ? <p className="tuti-product-card__summary">{summary}</p> : null}
        {tags.length ? (
          <div className="tuti-product-card__tags">
            {tags.map((tag) => <TutiBadge tone="champagne" key={tag}>{tag}</TutiBadge>)}
          </div>
        ) : null}
        <div className="tuti-product-card__footer">
          <TutiPrice price={price} compareAtPrice={compareAtPrice} size={variant === "compact" ? "sm" : "md"} />
          {showViewButton ? (
            <TutiButton
              as={href ? "a" : "button"}
              href={href}
              type="button"
              variant="ghost"
              size="sm"
              icon={<ShoppingBag size={15} />}
              iconPosition="right"
              onClick={href && !onViewProduct ? undefined : viewProduct}
              disabled={disabled}
              className="tuti-product-card__view"
            >
              View
            </TutiButton>
          ) : null}
        </div>
      </div>
    </TutiCard>
  );
}
