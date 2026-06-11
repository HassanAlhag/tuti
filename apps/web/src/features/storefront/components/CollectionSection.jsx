import { ArrowRight } from "lucide-react";
import { ProductCard } from "./ProductCard.jsx";

export function CollectionSection({ collection, getProduct, getShop, onAddToCart, onRateProduct }) {
  const products = collection.productIds.map(getProduct).filter(Boolean);

  return (
    <section className="collection-section" id={collection.id === "collection-new" ? "new-releases" : undefined}>
      <header className="section-heading">
        <div>
          <span className="eyebrow">{collection.id === "collection-new" ? "Just landed" : "Curated edit"}</span>
          <h2>{collection.title}</h2>
          <p>{collection.description}</p>
        </div>
        <button className="ghost-action compact" type="button">
          View all
          <ArrowRight size={16} />
        </button>
      </header>
      <div className="collection-grid">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            shop={getShop(product.shopId)}
            onAddToCart={onAddToCart}
            onRateProduct={() => onRateProduct(product.id)}
          />
        ))}
      </div>
    </section>
  );
}
