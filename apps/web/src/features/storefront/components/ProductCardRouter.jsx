import { CakeCard } from "./CakeCard.jsx";
import { GiftBoxCard } from "./GiftBoxCard.jsx";
import { ProductCard } from "./ProductCard.jsx";

export function ProductCardRouter({ product, shop, onAddToCart, onRateProduct, onViewProduct }) {
  const cat = product?.category;

  if (cat === "gift_box" || cat === "bundle") {
    return <GiftBoxCard product={product} shop={shop} onAddToCart={onAddToCart} onViewProduct={onViewProduct} />;
  }

  if (cat === "cake" || cat === "dessert") {
    return <CakeCard product={product} shop={shop} onAddToCart={onAddToCart} onViewProduct={onViewProduct} />;
  }

  // Default: perfume card
  return (
    <ProductCard
      product={product}
      shop={shop}
      onAddToCart={onAddToCart}
      onRateProduct={onRateProduct}
      onViewProduct={onViewProduct}
    />
  );
}
