import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Cake,
  CalendarClock,
  CheckCircle2,
  Gift,
  MapPin,
  MessageSquare,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Truck,
} from "lucide-react";
import { ReviewContributionPanel } from "../reviews/ReviewContributionPanel.jsx";
import { ProductCardRouter } from "../storefront/components/ProductCardRouter.jsx";
import { BottleArt } from "@tuti/shared/components/BottleArt.jsx";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import { bayesianScore } from "@tuti/shared/utils/rating.js";
import { trackPageView } from "../tracking/marketplaceTracking.js";

const typeMeta = {
  perfume: {
    label: "Perfume",
    backLabel: "Back to perfumes",
    relatedLabel: "Related perfumes",
    cta: "Add perfume to cart",
    pairingTitle: "Recommended dessert pairing",
  },
  cake: {
    label: "Cake",
    backLabel: "Back to cakes",
    relatedLabel: "Related cakes",
    cta: "Add cake to cart",
    pairingTitle: "Recommended perfume pairing",
  },
  dessert: {
    label: "Dessert",
    backLabel: "Back to cakes",
    relatedLabel: "Related desserts",
    cta: "Add sweets to cart",
    pairingTitle: "Recommended perfume pairing",
  },
  gift_box: {
    label: "Gift set",
    backLabel: "Back to gift sets",
    relatedLabel: "Related gift sets",
    cta: "Add gift set to cart",
    pairingTitle: "Inside this gift box",
  },
  bundle: {
    label: "Bundle",
    backLabel: "Back to gift sets",
    relatedLabel: "Related bundles",
    cta: "Add bundle to cart",
    pairingTitle: "Inside this bundle",
  },
};

function getProductType(product) {
  return product?.category || "perfume";
}

function getCategoryForBack(product) {
  const type = getProductType(product);
  if (type === "cake" || type === "dessert") return "cake";
  if (type === "gift_box" || type === "bundle") return "gift_box";
  return "perfume";
}

function DetailArt({ product }) {
  if (product?.imagePath) {
    return (
      <div className="detail-uploaded-img">
        <img src={product.imagePath} alt={product.name} />
      </div>
    );
  }

  const type = getProductType(product);

  if (type === "cake" || type === "dessert") {
    return (
      <div className="detail-cake-art" style={{ "--cake-color": product.color, "--cake-accent": product.accent }}>
        <div className="detail-cake-plate" />
        <div className="detail-cake-layer bottom" />
        <div className="detail-cake-layer middle" />
        <div className="detail-cake-layer top" />
        <div className="detail-cake-candle" />
      </div>
    );
  }

  if (type === "gift_box" || type === "bundle") {
    return (
      <div className="detail-gift-art" style={{ "--gift-color": product.color, "--gift-accent": product.accent }}>
        <div className="detail-gift-lid" />
        <div className="detail-gift-body">
          <div className="detail-gift-ribbon-x" />
          <div className="detail-gift-ribbon-y" />
          <Gift size={42} />
        </div>
      </div>
    );
  }

  return <BottleArt product={product} />;
}

function DetailBlock({ title, children }) {
  return (
    <article className="detail-info-card">
      <h2>{title}</h2>
      {children}
    </article>
  );
}

function NoteList({ label, notes }) {
  if (!notes?.length) return null;
  return (
    <div className="note-list-row">
      <strong>{label}</strong>
      <span>{notes.join(" · ")}</span>
    </div>
  );
}

function NoteChipRow({ level, label, notes }) {
  if (!notes?.length) return null;
  return (
    <div className={`note-row note-row--${level}`}>
      <span className="note-row-label">{label}</span>
      <div className="note-chips">
        {notes.map((note) => (
          <span className="note-chip" key={`${level}-${note}`}>
            {note}
          </span>
        ))}
      </div>
    </div>
  );
}

function getPairings(product, products) {
  const type = getProductType(product);

  if (type === "gift_box" || type === "bundle") {
    return (product.bundledProductIds || [])
      .map((id) => products.find((item) => item.id === id))
      .filter((item) => item && item.id !== product.id && item.status === "Live")
      .slice(0, 4);
  }

  if (type === "perfume") {
    return products
      .filter((item) => item.id !== product.id && item.status === "Live")
      .filter((item) => {
        const itemType = getProductType(item);
        return itemType === "cake" || itemType === "dessert";
      })
      .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
      .slice(0, 2);
  }

  if (type === "cake" || type === "dessert") {
    return products
      .filter((item) => item.id !== product.id && item.status === "Live")
      .filter((item) => getProductType(item) === "perfume")
      .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
      .slice(0, 2);
  }

  return [];
}

export function ProductDetailPage({
  getShop,
  goToCart,
  goToShop,
  product,
  products,
  reviewDraft,
  reviewList,
  reviewNote,
  setReviewDraft,
  submitCustomerReview,
  onAddToCart,
  onRateProduct,
  onViewProduct,
}) {
  const pageViewKeyRef = useRef("");
  const actionsRef = useRef(null);
  const [showStickyBar, setShowStickyBar] = useState(false);

  useEffect(() => {
    if (!product?.id) return;
    const pageViewKey = [product.id, product.slug || "", product.shopId || ""].join("|");
    if (pageViewKeyRef.current === pageViewKey) return;
    pageViewKeyRef.current = pageViewKey;
    void trackPageView({
      eventType: "product_view",
      source: "web_product_page",
      route: typeof window !== "undefined" ? window.location.pathname : "",
      context: {
        productId: product.id,
        shopId: product.shopId || null,
        sellerShopId: product.shopId || null,
        metadata: {
          productSlug: product.slug || "",
        },
      },
    });
  }, [product?.id, product?.shopId, product?.slug]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.IntersectionObserver === "undefined") return undefined;
    if (!actionsRef.current) return undefined;

    const observer = new window.IntersectionObserver(([entry]) => {
      setShowStickyBar(!entry?.isIntersecting);
    }, { threshold: 0.15 });

    observer.observe(actionsRef.current);
    return () => observer.disconnect();
  }, [product?.id]);

  if (!product) {
    return (
      <main className="page-shell">
        <section className="not-found-panel">
          <h1>Product not found</h1>
          <button className="primary-action" onClick={() => goToShop("all")} type="button">
            <ArrowLeft size={17} />
            Back to shop
          </button>
        </section>
      </main>
    );
  }

  const type = getProductType(product);
  const meta = typeMeta[type] || typeMeta.perfume;
  const releaseLabel = product.releaseType?.toLowerCase() === meta.label.toLowerCase() ? "" : product.releaseType;
  const shop = getShop(product.shopId);
  const score = bayesianScore(product.rating, product.reviews);
  const isPerfume = type === "perfume";
  const isCake = type === "cake" || type === "dessert";
  const isGift = type === "gift_box" || type === "bundle";
  const sellerInitials = String(shop?.name || "TS")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const sellerLocation = shop?.city || "UAE";
  const pairingProducts = getPairings(product, products);
  const availabilityLabel = product.stock > 0 ? "In stock" : "Out of stock";
  const leadTimeLabel = product.leadTimeDays
    ? `${product.leadTimeDays} day${product.leadTimeDays === 1 ? "" : "s"} lead time`
    : "Ready to dispatch";
  const availabilityDetail = product.stock > 5 ? "In stock" : product.stock > 0 ? "Limited availability" : "Out of stock";
  const hasNotePyramid = Boolean(
    product.notePyramid?.top?.length
    || product.notePyramid?.heart?.length
    || product.notePyramid?.base?.length
  );
  const related = products
    .filter((item) => {
      if (item.id === product.id) return false;
      const itemType = getProductType(item);
      if (isPerfume) return itemType === "perfume" && (item.family === product.family || item.shopId === product.shopId);
      if (isCake) return (itemType === "cake" || itemType === "dessert") && (item.cakeType === product.cakeType || item.shopId === product.shopId);
      return (itemType === "gift_box" || itemType === "bundle") || item.shopId === product.shopId;
    })
    .slice(0, 4);

  function addAndCheckout() {
    onAddToCart(product);
    goToCart();
  }

  return (
    <main className="page-shell">
      <button className="ghost-action compact page-back" onClick={() => goToShop(getCategoryForBack(product))} type="button">
        <ArrowLeft size={16} />
        {meta.backLabel}
      </button>

      <section className="product-detail-layout product-detail-layout-wide">
        <div className="product-gallery-panel">
          <DetailArt product={product} />
        </div>

        <section className="product-detail-main">
          <div className="product-detail-kicker">
            <span>{meta.label}</span>
            {releaseLabel ? <span>{releaseLabel}</span> : null}
          </div>
          <h1>{product.name}</h1>
          <div className="detail-subhead-row">
            {shop?.name ? (
              <button className="detail-shop-link" onClick={() => goToShop(getCategoryForBack(product))} type="button">
                Explore products
              </button>
            ) : null}
            <span>{product.category || meta.label}</span>
            <span>{availabilityDetail}</span>
            {product.leadTimeDays ? <span>{leadTimeLabel}</span> : null}
          </div>
          <div className="detail-price">
            <strong>{formatCurrency(product.price)}</strong>
            {product.originalPrice ? <del>{formatCurrency(product.originalPrice)}</del> : null}
          </div>
          <div className="detail-rating-row">
            <Star size={18} fill="currentColor" />
            <strong>{score}</strong>
            <span>{product.reviews} reviews · {product.verifiedReviews} verified purchases</span>
          </div>
          <div className="detail-actions" ref={actionsRef}>
            <button className="primary-action" onClick={() => onAddToCart(product)} type="button">
              <ShoppingBag size={18} />
              {meta.cta}
            </button>
            <button className="secondary-action" onClick={addAndCheckout} type="button">
              <PackageCheck size={18} />
              Continue order
            </button>
            {isPerfume ? (
              <button className="ghost-action" onClick={() => onRateProduct(product.id)} type="button">
                <MessageSquare size={18} />
                Write a review
              </button>
            ) : null}
          </div>
          <div className="detail-tags">
            {(product.tags || []).map((tag) => <span key={tag}>{tag}</span>)}
          </div>
          <div className="detail-trust-strip">
            <span><Truck size={16} /> Cash on delivery</span>
            <span><MapPin size={16} /> UAE boutique seller</span>
            <span><PackageCheck size={16} /> Seller fulfilled</span>
            <span><ShieldCheck size={16} /> Tuti buyer support</span>
            {isGift ? <span><Gift size={16} /> Gift packaging included</span> : null}
          </div>
          <p>
            {isPerfume
              ? (product.notes || []).join(" · ")
              : isGift
              ? (product.includes || []).slice(0, 3).join(" · ")
              : (product.flavors || []).join(" · ")}
          </p>
        </section>

        <aside className="detail-shop-card">
          <div className="detail-seller-avatar">{sellerInitials}</div>
          <div className="detail-seller-name-row">
            <h2>{shop?.name || "Boutique seller"}</h2>
            <span><MapPin size={14} /> {sellerLocation}</span>
          </div>
          {shop?.story ? <p className="detail-seller-story">{shop.story}</p> : null}
          <div className="detail-seller-trust">
            <span><ShieldCheck size={16} /> Verified seller</span>
            <span><MapPin size={16} /> {shop?.city ? `${shop.city} boutique` : "UAE boutique"}</span>
          </div>
          <button className="ghost-action compact detail-seller-link" onClick={() => goToShop("all")} type="button">
            <Store size={16} />
            Browse all sellers
          </button>
        </aside>
      </section>

      <section className="detail-info-grid">
        {isPerfume ? (
          <>
            <DetailBlock title="Fragrance notes">
              <NoteChipRow level="top" label="Top notes" notes={product.notePyramid?.top} />
              <NoteChipRow level="heart" label="Heart notes" notes={product.notePyramid?.heart} />
              <NoteChipRow level="base" label="Base notes" notes={product.notePyramid?.base} />
              {!hasNotePyramid && product.notes?.length ? (
                <div className="note-chips">
                  {product.notes.map((note) => (
                    <span className="note-chip note-chip--flat" key={`flat-${note}`}>
                      {note}
                    </span>
                  ))}
                </div>
              ) : null}
            </DetailBlock>
            <DetailBlock title="Perfume details">
              <div className="detail-spec-grid">
                <span><Sparkles size={16} /> Scent family: {product.family}</span>
                <span><Gift size={16} /> Gender: {product.gender || "Unisex"}</span>
                <span><PackageCheck size={16} /> Size: {product.size || "Standard"}</span>
                <span><ShieldCheck size={16} /> Intensity: {product.intensity}</span>
                <span><CalendarClock size={16} /> Longevity: {product.longevity}</span>
                <span><Gift size={16} /> Best occasion: {(product.occasion || []).join(", ")}</span>
                <span><Truck size={16} /> Availability: {availabilityLabel}</span>
              </div>
            </DetailBlock>
          </>
        ) : null}

        {isCake ? (
          <>
            <DetailBlock title="Cake & dessert details">
              <div className="detail-spec-grid">
                <span><Cake size={16} /> Type: {product.cakeType}</span>
                <span><PackageCheck size={16} /> Servings: {product.servings || "Box serving varies"}</span>
                <span><CalendarClock size={16} /> Lead time: {product.leadTimeDays === 1 ? "Same-day available" : `${product.leadTimeDays || 1} day lead time`}</span>
                <span><MessageSquare size={16} /> Custom message: {product.customMessageAvailable ? "Available" : "Not available"}</span>
                <span><Truck size={16} /> Stock: {availabilityLabel}</span>
              </div>
            </DetailBlock>
            <DetailBlock title="Flavor, ingredients, and allergens">
              <NoteList label="Flavor" notes={product.flavors} />
              <NoteList label="Allergens" notes={product.allergens} />
              <p className="detail-muted">Keep refrigerated and serve within 24-48 hours for best texture.</p>
            </DetailBlock>
          </>
        ) : null}

        {isGift ? (
          <>
            <DetailBlock title="Gift box includes">
              <ul className="detail-check-list">
                {(product.includes || []).map((item) => (
                  <li key={item}><CheckCircle2 size={16} /> {item}</li>
                ))}
              </ul>
            </DetailBlock>
            <DetailBlock title="Gift options">
              <div className="detail-spec-grid">
                <span><Gift size={16} /> Luxury packaging included</span>
                <span><MessageSquare size={16} /> Personalised card: {product.customMessageAvailable ? "Available" : "Not available"}</span>
                <span><CalendarClock size={16} /> Lead time: {product.leadTimeDays || 1} days</span>
                <span><Truck size={16} /> Delivery scheduling supported</span>
                <span><Sparkles size={16} /> Occasions: {(product.occasionTags || []).join(", ") || "All occasions"}</span>
              </div>
            </DetailBlock>
          </>
        ) : null}

        <DetailBlock title="Description and care">
          <p>{product.description || "A Tuti boutique product prepared for gifting, celebration, and memorable moments."}</p>
          {product.ingredients?.length ? <NoteList label="Ingredients" notes={product.ingredients} /> : null}
          {product.howToUse ? <NoteList label="How to use" notes={[product.howToUse]} /> : null}
          <NoteList label="Delivery & returns" notes={[product.deliveryReturns || "Delivery date and time can be selected at checkout. Cake and dessert returns follow freshness policy."]} />
        </DetailBlock>
      </section>

      {pairingProducts.length ? (
        <section className="collection-section detail-section">
          <header className="section-heading">
            <div>
              <span className="eyebrow">The Tuti pairing idea</span>
              <h2>{meta.pairingTitle}</h2>
            </div>
          </header>
          <div className="collection-grid">
            {pairingProducts.map((item) => (
              <ProductCardRouter
                key={item.id}
                product={item}
                shop={getShop(item.shopId)}
                onAddToCart={onAddToCart}
                onRateProduct={() => onViewProduct(item.id)}
                onViewProduct={() => onViewProduct(item.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {related.length >= 2 ? (
        <section className="collection-section detail-section">
          <header className="section-heading">
            <div>
              <span className="eyebrow">You may also like</span>
              <h2>{meta.relatedLabel}</h2>
            </div>
          </header>
          <div className="collection-grid">
            {related.map((item) => (
              <ProductCardRouter
                key={item.id}
                product={item}
                shop={getShop(item.shopId)}
                onAddToCart={onAddToCart}
                onRateProduct={() => onViewProduct(item.id)}
                onViewProduct={() => onViewProduct(item.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="detail-review-section">
        <ReviewContributionPanel
          product={product}
          reviewDraft={reviewDraft}
          reviewList={reviewList}
          reviewNote={reviewNote}
          setReviewDraft={setReviewDraft}
          submitCustomerReview={submitCustomerReview}
        />
      </section>

      {showStickyBar ? (
        <div className="detail-sticky-bar">
          <div className="detail-sticky-copy">
            <strong className="detail-sticky-name">{product.name}</strong>
            <span className="detail-sticky-price">{formatCurrency(product.price)}</span>
          </div>
          <button
            className="primary-action compact"
            disabled={product.stock === 0}
            onClick={() => onAddToCart(product)}
            type="button"
          >
            <ShoppingBag size={16} />
            {product.stock === 0 ? "Out of stock" : "Add to cart"}
          </button>
        </div>
      ) : null}
    </main>
  );
}
