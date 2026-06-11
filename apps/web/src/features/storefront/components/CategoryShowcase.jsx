import { useRef, useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import perfumeImage from "../../../assets/category-perfumes.jpg";
import cakeImage from "../../../assets/category-cakes.jpg";
import giftSetImage from "../../../assets/category-gift-sets.jpg";
import { ProductCardRouter } from "./ProductCardRouter.jsx";

/* ── Category metadata ───────────────────────────────────────── */
const META = {
  perfume: {
    badge:    "✦ Perfumes",
    title:    "Discover your perfect scent",
    sub:      "Oud, amber, musk, floral, and fresh fragrances from boutique shops across the UAE.",
    from:     "#061a17",
    to:       "#0b4e47",
    accent:   "#4ecdc4",
    subColor: "rgba(255,255,255,0.65)",
    image: perfumeImage,
    cta: "Shop perfumes",
    slides: [
      { headline: ["Oud & Amber", "Reserve Collection"], note: "Deep · Warm · Long-lasting", stat: "5 scent families" },
      { headline: ["Fresh &",     "Everyday Scents"],    note: "Light · Clean · Office-ready", stat: "Daily wear edits" },
      { headline: ["Floral &",    "Gift Favourites"],    note: "Rose · Iris · Musk", stat: "Client-rated picks" },
    ],
  },
  cake: {
    badge:    "◆ Cakes & Desserts",
    title:    "Cakes baked with love",
    sub:      "Signature cakes, Arabic sweets, celebration desserts, and custom orders.",
    from:     "#1a0710",
    to:       "#7a2040",
    accent:   "#f4b6c4",
    subColor: "rgba(255,255,255,0.65)",
    image: cakeImage,
    cta: "Shop cakes",
    slides: [
      { headline: ["Signature",   "Celebration Cakes"], note: "Custom message available", stat: "Fresh bakery partners" },
      { headline: ["Arabic",      "Sweet Collection"],  note: "Baklava · Maamoul · Konafa", stat: "Eid and Ramadan edits" },
      { headline: ["Mini Cakes",  "& Dessert Boxes"],   note: "Perfect for gifting", stat: "1-2 day lead time" },
    ],
  },
  gift_box: {
    badge:    "◈ Gift Sets",
    title:    "The most thoughtful gifts",
    sub:      "Perfume and cake beautifully paired in luxury gift boxes — for every occasion.",
    from:     "#1a0d07",
    to:       "#5c2b10",
    accent:   "#d9a441",
    subColor: "rgba(255,255,255,0.65)",
    image: giftSetImage,
    cta: "Shop gift sets",
    slides: [
      { headline: ["Birthday &",    "Anniversary Sets"], note: "Includes personalised card", stat: "Perfume + dessert pairings" },
      { headline: ["Eid &",         "Ramadan Gifts"],    note: "Seasonal luxury sets", stat: "Warm oud and sweets" },
      { headline: ["Corporate &",   "Event Gifting"],    note: "Bulk orders available", stat: "Custom packaging ready" },
    ],
  },
};

/* ── Mini auto-banner inside the showcase ────────────────────── */
function CategoryBanner({ meta, productCount }) {
  const [current, setCurrent] = useState(0);
  const [paused,  setPaused]  = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setCurrent((c) => (c + 1) % meta.slides.length), 4000);
    return () => clearTimeout(t);
  }, [current, paused, meta]);

  function go(index) {
    setCurrent((index + meta.slides.length) % meta.slides.length);
  }

  const slide = meta.slides[current];

  return (
    <div
      className="cat-banner"
      style={{ "--cb-from": meta.from, "--cb-to": meta.to, "--cb-accent": meta.accent }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <img className="cat-banner-image" src={meta.image} alt="" aria-hidden="true" />

      <div className="cat-banner-content" key={current}>
        <span className="cat-banner-badge" style={{ color: meta.accent }}>
          {meta.badge}
        </span>
        <h2 className="cat-banner-title">
          {slide.headline[0]}
          <br />
          <span style={{ color: meta.accent }}>{slide.headline[1]}</span>
        </h2>
        <p className="cat-banner-sub" style={{ color: meta.subColor }}>{meta.sub}</p>
        <span className="cat-banner-note" style={{ color: meta.accent }}>
          {slide.note}
        </span>
        <p className="cat-banner-count" style={{ color: meta.subColor }}>
          {slide.stat} · {productCount} products available
        </p>
        <button
          className="cat-banner-cta"
          onClick={() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          style={{ "--cb-button": meta.accent }}
          type="button"
        >
          {meta.cta}
          <ChevronRight size={17} />
        </button>
      </div>

      <button className="cat-banner-arrow cat-banner-prev" onClick={() => go(current - 1)} aria-label="Previous category slide" type="button">
        <ArrowLeft size={19} />
      </button>
      <button className="cat-banner-arrow cat-banner-next" onClick={() => go(current + 1)} aria-label="Next category slide" type="button">
        <ArrowRight size={19} />
      </button>

      {/* Slide dots */}
      <div className="cat-banner-dots">
        {meta.slides.map((_, i) => (
          <button
            key={i}
            className={i === current ? "cat-dot active" : "cat-dot"}
            onClick={() => setCurrent(i)}
            style={i === current ? { background: meta.accent } : {}}
            type="button"
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>

      <div className="cat-banner-counter">
        <span style={{ color: meta.accent }}>{String(current + 1).padStart(2, "0")}</span>
        {" / "}
        {String(meta.slides.length).padStart(2, "0")}
      </div>
    </div>
  );
}

/* ── Horizontal product carousel ─────────────────────────────── */
function ProductCarousel({ title, products, getShop, onAddToCart, onViewProduct }) {
  const trackRef = useRef(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  function updateArrows() {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft + el.offsetWidth < el.scrollWidth - 8);
  }

  function scroll(dir) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.offsetWidth * 0.75), behavior: "smooth" });
  }

  return (
    <div className="cat-carousel">
      <div className="cat-carousel-head">
        <h3 className="cat-carousel-title">{title}</h3>
        <div className="cat-carousel-arrows">
          <button
            className={canPrev ? "cat-arrow" : "cat-arrow disabled"}
            disabled={!canPrev}
            onClick={() => scroll(-1)}
            type="button"
            aria-label="Scroll left"
          >
            <ArrowLeft size={16} />
          </button>
          <button
            className={canNext ? "cat-arrow" : "cat-arrow disabled"}
            disabled={!canNext}
            onClick={() => scroll(1)}
            type="button"
            aria-label="Scroll right"
          >
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <div
        className="cat-carousel-track"
        ref={trackRef}
        onScroll={updateArrows}
      >
        {products.map((product) => (
          <div className="cat-carousel-item" key={product.id}>
            <ProductCardRouter
              product={product}
              shop={getShop(product.shopId)}
              onAddToCart={onAddToCart}
              onRateProduct={() => onViewProduct(product.id)}
              onViewProduct={() => onViewProduct(product.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Public component ────────────────────────────────────────── */
export function CategoryShowcase({ category, products, getShop, onAddToCart, onViewProduct }) {
  const meta = META[category];
  if (!meta) return null;

  const live = products.filter(
    (p) => p.status === "Live" && (
      category === "perfume"
        ? !p.category || p.category === "perfume"
        : category === "cake"
        ? p.category === "cake" || p.category === "dessert"
        : category === "gift_box"
        ? p.category === "gift_box" || p.category === "bundle"
        : p.category === category
    )
  );

  if (live.length === 0) return null;

  // Split into sub-groups for cake
  const cakeGroups = category === "cake"
    ? [
        { title: "Signature & Celebration Cakes", items: live.filter((p) => p.category === "cake") },
        { title: "Desserts & Sweet Boxes",         items: live.filter((p) => p.category === "dessert") },
      ].filter((g) => g.items.length > 0)
    : null;

  return (
    <div className="cat-showcase">
      <CategoryBanner meta={meta} productCount={live.length} />

      {cakeGroups ? (
        cakeGroups.map((group) => (
          <ProductCarousel
            key={group.title}
            title={group.title}
            products={group.items}
            getShop={getShop}
            onAddToCart={onAddToCart}
            onViewProduct={onViewProduct}
          />
        ))
      ) : (
        <ProductCarousel
          title={`All ${meta.badge.replace(/^[^\s]+\s/, "")}`}
          products={live}
          getShop={getShop}
          onAddToCart={onAddToCart}
          onViewProduct={onViewProduct}
        />
      )}
    </div>
  );
}
