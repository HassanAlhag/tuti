import { TutiEmptyState } from "../primitives/index.js";
import { TutiProductCard } from "./TutiProductCard.jsx";
import { getProductId, resolveShop } from "./commerceUtils.js";

const cx = (...parts) => parts.filter(Boolean).join(" ");

export function TutiProductGrid({
  products = [],
  shopsById,
  getShop,
  variant = "catalog",
  emptyState,
  onAddToCart,
  onViewProduct,
  onToggleWishlist,
  className = "",
}) {
  if (!products.length) {
    return emptyState || (
      <TutiEmptyState
        title="No products found"
        description="Try another category, search term, or gift direction."
      />
    );
  }

  return (
    <div className={cx("tuti-product-grid", `tuti-product-grid--${variant}`, className)}>
      {products.map((product, index) => (
        <TutiProductCard
          key={getProductId(product) || index}
          product={product}
          shop={resolveShop(product, shopsById, getShop)}
          variant={variant}
          onAddToCart={onAddToCart}
          onViewProduct={onViewProduct}
          onToggleWishlist={onToggleWishlist}
          showWishlist={Boolean(onToggleWishlist)}
        />
      ))}
    </div>
  );
}
