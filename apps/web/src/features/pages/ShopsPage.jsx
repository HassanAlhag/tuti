import { MapPin, ShieldCheck, Store, Truck } from "lucide-react";

export function ShopsPage({ shops }) {
  return (
    <main className="page-shell">
      <section className="page-hero-simple">
        <span className="eyebrow">Seller marketplace</span>
        <h1>Independent perfume shops</h1>
        <p>Every shop has its own seller account, catalog, fulfillment history, payout rules, and customer rating surface.</p>
      </section>

      <section className="shops-page-grid">
        {shops.map((shop) => (
          <article className="shop-profile-card" key={shop.id}>
            <div className="shop-profile-top">
              <div className="shop-avatar">{shop.avatar}</div>
              <div>
                <h2>{shop.name}</h2>
                <span><MapPin size={15} /> {shop.city}</span>
              </div>
            </div>
            <p>{shop.story}</p>
            <div className="shop-profile-stats">
              <span><Truck size={16} /> {shop.fulfillmentRate}% fulfillment</span>
              <span><ShieldCheck size={16} /> {shop.status}</span>
              <span><Store size={16} /> {shop.cover}</span>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
