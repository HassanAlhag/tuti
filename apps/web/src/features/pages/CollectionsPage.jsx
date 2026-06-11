import { ArrowRight } from "lucide-react";
import { ProductCard } from "../storefront/components/ProductCard.jsx";

export function CollectionsPage({ collections, getProduct, getShop, goToShop, onAddToCart, onRateProduct }) {
  return (
    <main className="page-shell">
      <section className="page-hero-simple">
        <span className="eyebrow">Tuti collections</span>
        <h1>Curated perfume edits</h1>
        <p>Seasonal edits, new drops, luxury perfumes, and daily-wear collections separated into their own browsable pages.</p>
        <button className="primary-action" onClick={goToShop} type="button">
          Shop full catalog
          <ArrowRight size={17} />
        </button>
      </section>

      <section className="collections-page-grid">
        {collections.map((collection) => {
          const products = collection.productIds.map(getProduct).filter(Boolean);
          return (
            <article className="collection-page-card" key={collection.id}>
              <header>
                <span className="eyebrow">Collection</span>
                <h2>{collection.title}</h2>
                <p>{collection.description}</p>
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
            </article>
          );
        })}
      </section>
    </main>
  );
}
