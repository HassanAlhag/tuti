import { TutiButton, TutiCarousel } from "../primitives/index.js";
import { TutiProductCard } from "./TutiProductCard.jsx";
import { getProductId, resolveShop } from "./commerceUtils.js";

export function TutiProductRail({
  title,
  eyebrow,
  subtitle,
  products = [],
  shopsById,
  getShop,
  variant = "featured",
  viewAllHref,
  onAddToCart,
  onViewProduct,
  onToggleWishlist,
  className = "",
}) {
  const viewAll = viewAllHref ? (
    <TutiButton as="a" href={viewAllHref} variant="ghost" size="sm">
      View all
    </TutiButton>
  ) : null;

  return (
    <TutiCarousel
      title={title}
      eyebrow={eyebrow}
      subtitle={subtitle}
      items={products}
      viewAll={viewAll}
      className={className}
      itemLabel="product"
      renderItem={(product, index) => (
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
      )}
    />
  );
}
