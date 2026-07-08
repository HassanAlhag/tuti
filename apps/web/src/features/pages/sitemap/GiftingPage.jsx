import { Gift, PackageCheck, WalletCards, CreditCard, Building2, ShoppingBag } from "lucide-react";
import { BottleArt } from "@tuti/shared/components/BottleArt.jsx";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import { giftCategories } from "../siteMap.js";
import { PageHero, FeatureGrid } from "./sitemapPageShared.jsx";
import { useSeoMeta } from "@tuti/shared/hooks/useSeoMeta.js";

export function GiftingPage({ products, getShop, onAddToCart, onNavigate }) {
  useSeoMeta({
    title: "Luxury Gifting — Perfumes, Cakes & Gift Boxes",
    description: "Browse ready-made gift boxes from boutiques, or build a personalised gift from one seller. Cash on delivery available.",
    canonical: "https://tuti.ae/gifting",
  });
  const giftProducts = products.filter((product) => product.category === "gift_box" || product.category === "bundle").slice(0, 3);
  const cakeDessertProducts = products
    .filter((product) => product.category === "cake" || product.category === "dessert")
    .slice(0, 3);
  const curatedGifts = products
    .filter((product) => ["gift_box", "bundle", "cake", "dessert"].includes(product.category))
    .slice(0, 3);
  const giftingGuides = [
    {
      title: "Birthday",
      text: "Choose a celebration cake or dessert and add a personal message for a joyful birthday gift.",
    },
    {
      title: "Anniversary",
      text: "Pick a premium perfume or a ready-made gift box for a refined anniversary present.",
    },
    {
      title: "Eid / Ramadan",
      text: "Go with oud signatures, Arabic sweets, and shared gifting trays.",
    },
    {
      title: "Corporate gifting",
      text: "Use premium gift sets and coordinated boxes for teams or clients.",
    },
  ];

  return (
    <main className="page-shell">
      <PageHero
        kicker="Gifting"
        title="Luxury gifting with perfumes, cakes, and signature boxes"
        text="Browse ready-made gift boxes from verified boutiques, or build a personalised gift from one seller with cash-on-delivery checkout."
      >
        <button className="primary-action" onClick={() => onNavigate("/build-a-box")} type="button">
          <PackageCheck size={18} />
          Build a Gift
        </button>
        <button className="primary-action" onClick={() => onNavigate("/shop?c=gift_box")} type="button">
          <Gift size={18} />
          Shop gift boxes
        </button>
        <div className="gifting-payment-strip">
          <span><WalletCards size={15} /> COD available</span>
          <span><CreditCard size={15} /> Secure checkout</span>
        </div>
      </PageHero>

      <section className="gifting-build-box-card">
        <div>
          <span className="eyebrow">Build a Gift</span>
          <h2>Create one premium gift in three steps</h2>
          <p>Choose your products from one boutique, add a personal message, and check out as one curated gift item.</p>
        </div>
        <button className="secondary-action" onClick={() => onNavigate("/build-a-box")} type="button">
          <PackageCheck size={18} />
          Start building your gift
        </button>
      </section>

      <section className="gifting-guide-section">
        <h2 className="gifting-guide-section-title">Shop by occasion</h2>
        <div className="gifting-guide-grid">
          {giftingGuides.map((item) => (
            <article className="gifting-guide-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="gifting-sections-grid">
        <article className="gifting-section-card">
          <div className="gifting-section-head">
            <h2>Gift boxes</h2>
            <button className="ghost-action compact" onClick={() => onNavigate("/shop?c=gift_box")} type="button">
              View all
            </button>
          </div>
          <div className="finder-product-stack">
            {giftProducts.map((product) => (
              <article className="finder-product" key={product.id}>
                <BottleArt product={product} compact />
                <div>
                  <strong>{product.name}</strong>
                  <span>{getShop(product.shopId)?.name} · {formatCurrency(product.price)}</span>
                </div>
                <button className="icon-button primary" onClick={() => onAddToCart(product)} title="Add to cart" type="button">
                  <ShoppingBag size={17} />
                </button>
              </article>
            ))}
          </div>
        </article>

        <article className="gifting-section-card">
          <div className="gifting-section-head">
            <h2>Cakes & desserts</h2>
            <button className="ghost-action compact" onClick={() => onNavigate("/shop?c=cake")} type="button">
              View all
            </button>
          </div>
          <div className="finder-product-stack">
            {cakeDessertProducts.map((product) => (
              <article className="finder-product" key={product.id}>
                <BottleArt product={product} compact />
                <div>
                  <strong>{product.name}</strong>
                  <span>{getShop(product.shopId)?.name} · {formatCurrency(product.price)}</span>
                </div>
                <button className="icon-button primary" onClick={() => onAddToCart(product)} title="Add to cart" type="button">
                  <ShoppingBag size={17} />
                </button>
              </article>
            ))}
          </div>
        </article>

        <article className="gifting-section-card dark">
          <span className="sitemap-card-icon"><Building2 size={20} /></span>
          <h2>Curated gifting picks</h2>
          <p>Premium picks curated for personal gifting and team occasions.</p>
          <div className="finder-product-stack">
            {curatedGifts.map((product) => (
              <article className="finder-product" key={product.id}>
                <BottleArt product={product} compact />
                <div>
                  <strong>{product.name}</strong>
                  <span>{getShop(product.shopId)?.name} · {formatCurrency(product.price)}</span>
                </div>
                <button className="icon-button primary" onClick={() => onAddToCart(product)} title="Add to cart" type="button">
                  <ShoppingBag size={17} />
                </button>
              </article>
            ))}
          </div>
        </article>
      </section>

      <FeatureGrid items={giftCategories} icon={Gift} onNavigate={onNavigate} />
    </main>
  );
}
