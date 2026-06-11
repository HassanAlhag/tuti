import { Store } from "lucide-react";

export function ShopSpotlight({ shops }) {
  return (
    <section className="shop-spotlight">
      <header className="section-heading">
        <div>
          <span className="eyebrow">Independent sellers</span>
          <h2>Meet the shops behind the scents</h2>
          <p>Each seller has a separate account, catalog, orders, and payout area.</p>
        </div>
      </header>
      <div className="shop-grid">
        {shops.map((shop) => (
          <article className="shop-card" key={shop.id}>
            <div className="shop-avatar">{shop.avatar}</div>
            <span><Store size={16} /> {shop.city}</span>
            <h3>{shop.name}</h3>
            <p>{shop.story}</p>
            <strong>{shop.fulfillmentRate}% fulfillment</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
