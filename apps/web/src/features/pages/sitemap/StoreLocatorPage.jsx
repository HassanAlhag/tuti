import { MapPin } from "lucide-react";
import { PageHero } from "./sitemapPageShared.jsx";

export function StoreLocatorPage() {
  return (
    <main className="page-shell">
      <PageHero
        kicker="Store locator"
        title="Boutique and pickup locations"
        text="Prepared for physical stores, partner boutiques, pickup points, opening hours, and contact details."
      />
      <section className="store-locator-card">
        <MapPin size={28} />
        <h2>Dubai perfume pickup partner</h2>
        <p>Store list, map, opening hours, and contact details can be connected here when physical locations are ready.</p>
      </section>
    </main>
  );
}
