import { useMemo, useState } from "react";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { BottleArt } from "@tuti/shared/components/BottleArt.jsx";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import { PageHero } from "./sitemapPageShared.jsx";

export function FragranceFinderPage({ products, getShop, onAddToCart, onNavigate, onViewProduct, onShopWithPreferences }) {
  const [preferences, setPreferences] = useState({
    family: "Oud",
    occasion: "Evening",
    intensity: "Strong",
    gender: "Unisex",
  });

  const recommended = useMemo(() => {
    const scored = products.map((product) => {
      const occasions = product.occasion || [];
      let score = 0;
      if (product.family === preferences.family) score += 3;
      if (product.gender === preferences.gender || product.gender === "Unisex") score += 2;
      if (product.intensity === preferences.intensity) score += 2;
      if (occasions.includes(preferences.occasion)) score += 2;
      return { product, score };
    });

    return scored
      .sort((a, b) => b.score - a.score || b.product.rating - a.product.rating)
      .slice(0, 3)
      .map((item) => item.product);
  }, [preferences, products]);

  const steps = [
    { key: "family", title: "Preferred scent type", options: ["Oud", "Floral", "Fresh", "Musk", "Amber"] },
    { key: "occasion", title: "Occasion", options: ["Daily", "Evening", "Office", "Gift", "Travel", "Formal"] },
    { key: "intensity", title: "Intensity", options: ["Soft", "Moderate", "Strong"] },
    { key: "gender", title: "Gender preference", options: ["Women", "Men", "Unisex"] },
  ];

  return (
    <main className="page-shell">
      <PageHero
        kicker="Find Your Scent"
        title="Discover scents that fit your mood, occasion, and style"
        text="Answer a few simple questions and discover scents that match your mood, occasion, and style."
      />

      <section className="finder-layout">
        <div className="finder-panel">
          {steps.map((step) => (
            <fieldset className="finder-step" key={step.key}>
              <legend>{step.title}</legend>
              <div>
                {step.options.map((option) => (
                  <button
                    className={preferences[step.key] === option ? "filter-tab active" : "filter-tab"}
                    key={option}
                    onClick={() => setPreferences((current) => ({ ...current, [step.key]: option }))}
                    type="button"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </div>

        <aside className="finder-results">
          <span className="eyebrow">Recommended result</span>
          <h2>Your Tuti edit</h2>
          <div className="finder-product-stack">
            {recommended.map((product) => (
              <article className="finder-product" key={product.id}>
                <BottleArt product={product} compact />
                <div>
                  <strong>{product.name}</strong>
                  <span>{product.family} · {product.intensity} · {formatCurrency(product.price)}</span>
                </div>
                <button className="icon-button" onClick={() => onViewProduct(product.id)} title="View perfume" type="button">
                  <ArrowRight size={17} />
                </button>
              </article>
            ))}
          </div>
          <button
            className="primary-action full-width"
            onClick={() => onShopWithPreferences ? onShopWithPreferences(preferences.family) : onNavigate("/shop")}
            type="button"
          >
            <ShoppingBag size={18} />
            Shop {preferences.family} perfumes
          </button>
        </aside>
      </section>
    </main>
  );
}
