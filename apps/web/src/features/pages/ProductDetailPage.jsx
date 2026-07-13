import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Cake,
  CalendarClock,
  CheckCircle2,
  Gift,
  Heart,
  MapPin,
  MessageSquare,
  Minus,
  PackageCheck,
  Plus,
  Send,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
} from "lucide-react";
import { RouteNotFound } from "../layout/RouteState.jsx";
import { TutiProductGrid } from "../../ui/customer/commerce/index.js";
import { BottleArt } from "@tuti/shared/components/BottleArt.jsx";
import { StarPicker } from "@tuti/shared/components/StarPicker.jsx";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import { bayesianScore } from "@tuti/shared/utils/rating.js";
import { useAuthStore } from "@tuti/shared/store/authStore.js";
import { useWishlistStore } from "@tuti/shared/store/wishlistStore.js";
import { trackPageView } from "../tracking/marketplaceTracking.js";
import { useSeoMeta } from "@tuti/shared/hooks/useSeoMeta.js";
import "./product-detail.css";

const typeMeta = {
  perfume: {
    label: "Perfume",
    backLabel: "Back to perfumes",
    relatedLabel: "Related perfumes",
    cta: "Add perfume to cart",
    pairingTitle: "You might also enjoy",
  },
  cake: {
    label: "Cake",
    backLabel: "Back to cakes",
    relatedLabel: "Related cakes",
    cta: "Add cake to cart",
    pairingTitle: "You might also enjoy",
  },
  dessert: {
    label: "Dessert",
    backLabel: "Back to cakes",
    relatedLabel: "Related desserts",
    cta: "Add sweets to cart",
    pairingTitle: "You might also enjoy",
  },
  gift_box: {
    label: "Gift box",
    backLabel: "Back to gift boxes",
    relatedLabel: "Related gift boxes",
    cta: "Add gift box to cart",
    pairingTitle: "Inside this gift box",
  },
  bundle: {
    label: "Gift box",
    backLabel: "Back to gift boxes",
    relatedLabel: "Related gift boxes",
    cta: "Add gift box to cart",
    pairingTitle: "Inside this gift box",
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

function Stars({ score, size = 14 }) {
  const filled = Math.round(Number(score) || 0);
  return (
    <span className="tuti-pdp__stars" aria-label={`${score} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          fill={i <= filled ? "currentColor" : "none"}
          className={i <= filled ? "is-filled" : ""}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function ProductVisual({ product }) {
  const type = getProductType(product);

  if (product?.imagePath) {
    return (
      <div className="tuti-pdp__uploaded-media">
        <img src={product.imagePath} alt={product.name} />
      </div>
    );
  }

  if (type === "cake" || type === "dessert") {
    return (
      <div className="tuti-pdp__cake-media" style={{ "--cake-color": product.color, "--cake-accent": product.accent }}>
        <span className="tuti-pdp__cake-plate" />
        <span className="tuti-pdp__cake-base" />
        <span className="tuti-pdp__cake-cream" />
        <span className="tuti-pdp__cake-top" />
      </div>
    );
  }

  if (type === "gift_box" || type === "bundle") {
    return (
      <div className="tuti-pdp__gift-media" style={{ "--gift-color": product.color, "--gift-accent": product.accent }}>
        <span className="tuti-pdp__gift-lid" />
        <span className="tuti-pdp__gift-box">
          <span className="tuti-pdp__gift-ribbon-x" />
          <span className="tuti-pdp__gift-ribbon-y" />
          <Gift size={38} aria-hidden="true" />
        </span>
      </div>
    );
  }

  return <BottleArt product={product} />;
}

function Chip({ children, tone = "neutral" }) {
  if (!children) return null;
  return <span className={`tuti-pdp__chip tuti-pdp__chip--${tone}`}>{children}</span>;
}

function Fact({ icon: Icon, label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div className="tuti-pdp__fact">
      {Icon ? <Icon size={15} aria-hidden="true" /> : null}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function NoteGroup({ label, notes }) {
  if (!notes?.length) return null;
  return (
    <div className="tuti-pdp__note-group">
      <span>{label}</span>
      <div>
        {notes.map((note) => (
          <Chip key={`${label}-${note}`} tone="soft">{note}</Chip>
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

function ReviewAspect({ label, value, onChange }) {
  return (
    <div className="tuti-pdp__review-aspect">
      <span>{label}</span>
      <div role="group" aria-label={`${label} score`}>
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={`${label}-${score}`}
            type="button"
            aria-pressed={score === value}
            className={score === value ? "is-selected" : ""}
            onClick={() => onChange(score)}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProductInfo({ product, type, availabilityDetail, isPerfume, isCake, isGift }) {
  const notePyramid = product.notePyramid || {};
  const occasion = (product.occasion || product.occasionTags || []).join(", ");
  const story = product.description || "A Tuti boutique product prepared for thoughtful gifting, celebration, and memorable moments.";
  const delivery = product.deliveryReturns || "Delivery date and time can be selected at checkout. Cash on delivery is available for launch orders.";

  return (
    <section className="tuti-pdp__info" aria-labelledby="tuti-pdp-info-title">
      <header className="tuti-pdp__section-head">
        <span>Product information</span>
        <h2 id="tuti-pdp-info-title">Details, care, and delivery</h2>
      </header>

      <div className="tuti-pdp__info-grid">
        <div className="tuti-pdp__story">
          <h3>Product story</h3>
          <p>{story}</p>
          {product.howToUse ? (
            <>
              <h3>How to use</h3>
              <p>{product.howToUse}</p>
            </>
          ) : null}
          <h3>Delivery &amp; returns</h3>
          <p>{delivery}</p>
        </div>

        <div className="tuti-pdp__facts">
          {isPerfume ? (
            <>
              <Fact icon={Sparkles} label="Scent family" value={product.family} />
              <Fact icon={Gift} label="Gender" value={product.gender || "Unisex"} />
              <Fact icon={PackageCheck} label="Size" value={product.size || "Standard"} />
              <Fact icon={ShieldCheck} label="Intensity" value={product.intensity} />
              <Fact icon={CalendarClock} label="Longevity" value={product.longevity} />
              <Fact icon={Gift} label="Best occasion" value={occasion} />
              <Fact icon={Truck} label="Availability" value={availabilityDetail} />
            </>
          ) : null}

          {isCake ? (
            <>
              <Fact icon={Cake} label="Type" value={product.cakeType || typeMeta[type]?.label} />
              <Fact icon={PackageCheck} label="Servings" value={product.servings || "Box serving varies"} />
              <Fact icon={CalendarClock} label="Lead time" value={product.leadTimeDays === 1 ? "Same-day available" : `${product.leadTimeDays || 1} day lead time`} />
              <Fact icon={MessageSquare} label="Custom message" value={product.customMessageAvailable ? "Available" : "Not available"} />
              <Fact icon={Truck} label="Storage" value="Keep refrigerated; serve within 24-48 hours" />
            </>
          ) : null}

          {isGift ? (
            <>
              <Fact icon={Gift} label="Packaging" value="Luxury wrapping included" />
              <Fact icon={MessageSquare} label="Personalised card" value={product.customMessageAvailable ? "Available" : "Not available"} />
              <Fact icon={CalendarClock} label="Lead time" value={`${product.leadTimeDays || 1} day${product.leadTimeDays === 1 ? "" : "s"}`} />
              <Fact icon={Truck} label="Delivery" value="Scheduling supported" />
              <Fact icon={Sparkles} label="Occasions" value={occasion || "All occasions"} />
            </>
          ) : null}
        </div>
      </div>

      <div className="tuti-pdp__notes">
        {isPerfume ? (
          <>
            <NoteGroup label="Top notes" notes={notePyramid.top} />
            <NoteGroup label="Heart notes" notes={notePyramid.heart} />
            <NoteGroup label="Base notes" notes={notePyramid.base} />
            {!notePyramid.top?.length && !notePyramid.heart?.length && !notePyramid.base?.length ? (
              <NoteGroup label="Notes" notes={product.notes} />
            ) : null}
          </>
        ) : null}
        {isCake ? (
          <>
            <NoteGroup label="Flavours" notes={product.flavors} />
            <NoteGroup label="Allergens" notes={product.allergens} />
            <NoteGroup label="Ingredients" notes={product.ingredients} />
          </>
        ) : null}
        {isGift ? (
          <>
            <NoteGroup label="Includes" notes={product.includes} />
            <NoteGroup label="Ingredients" notes={product.ingredients} />
          </>
        ) : null}
      </div>
    </section>
  );
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
  onViewProduct,
}) {
  const pageViewKeyRef = useRef("");
  const actionsRef = useRef(null);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const { isAuthenticated } = useAuthStore();
  const { has: isWishlisted, toggle: toggleWishlist } = useWishlistStore();

  useEffect(() => {
    setQuantity(1);
  }, [product?.id]);

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
        metadata: { productSlug: product.slug || "" },
      },
    });
  }, [product?.id, product?.shopId, product?.slug]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.IntersectionObserver === "undefined") return undefined;
    if (!actionsRef.current) return undefined;
    const observer = new window.IntersectionObserver(([entry]) => {
      setShowStickyBar(Boolean(entry && !entry.isIntersecting && entry.boundingClientRect.top < 0));
    }, { threshold: 0.15 });
    observer.observe(actionsRef.current);
    return () => observer.disconnect();
  }, [product?.id]);

  const productShop = product ? getShop(product.shopId) : null;
  useSeoMeta({
    title: product ? `${product.name}${productShop?.name ? ` by ${productShop.name}` : ""}` : undefined,
    description: product
      ? `${product.name} — ${product.description || (product.category === "perfume" ? "Luxury perfume" : product.category === "cake" ? "Custom cake" : "Premium Gift Box")}. Available on Tuti with cash on delivery.`
      : undefined,
    ogImage: product?.imagePath || undefined,
    canonical: product ? `https://tuti.ae/products/${product.slug || product.id}` : undefined,
    jsonLd: product ? {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: product.description || product.name,
      image: product.imagePath || undefined,
      sku: product.id,
      brand: productShop?.name ? { "@type": "Brand", name: productShop.name } : undefined,
      offers: {
        "@type": "Offer",
        priceCurrency: "AED",
        price: product.price,
        availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        url: `https://tuti.ae/products/${product.slug || product.id}`,
      },
    } : undefined,
  });

  if (!product) {
    return (
      <main className="page-shell">
        <RouteNotFound
          heading="Product not found"
          message="This product may have sold out, been removed, or the link may be incorrect."
          onPrimary={() => goToShop("all")}
          primaryLabel="Back to shop"
        />
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
  const leadTimeLabel = product.leadTimeDays
    ? `${product.leadTimeDays} day${product.leadTimeDays === 1 ? "" : "s"} lead time`
    : null;
  const availabilityDetail = product.stock > 5 ? "In stock" : product.stock > 0 ? "Limited stock" : "Out of stock";
  const reviewCount = product.reviews || 0;
  const verifiedCount = product.verifiedReviews || 0;
  const productReviews = reviewList.filter((review) => review.productId === product.id);
  const reviewLabels = isCake
    ? { first: "Taste", second: "Freshness", third: "Value", placeholder: "Share taste, freshness, delivery, packaging, or occasion notes" }
    : isGift
    ? { first: "Presentation", second: "Delivery", third: "Value", placeholder: "Share packaging, pairing, delivery, and gift experience notes" }
    : { first: "Scent", second: "Longevity", third: "Value", placeholder: "Share scent, longevity, value, delivery, or packaging notes" };

  const pairingProducts = getPairings(product, products);
  const related = products
    .filter((item) => {
      if (item.id === product.id) return false;
      const itemType = getProductType(item);
      if (isPerfume) return itemType === "perfume" && (item.family === product.family || item.shopId === product.shopId);
      if (isCake) return (itemType === "cake" || itemType === "dessert") && (item.cakeType === product.cakeType || item.shopId === product.shopId);
      return (itemType === "gift_box" || itemType === "bundle") || item.shopId === product.shopId;
    })
    .slice(0, 4);

  const shortPreview = isPerfume
    ? (product.notes || []).slice(0, 4).join(" · ")
    : isGift
    ? (product.includes || []).slice(0, 3).join(" · ")
    : (product.flavors || []).slice(0, 3).join(" · ");

  function addAndCheckout() {
    onAddToCart(product, quantity);
    goToCart();
  }

  return (
    <main className="tuti-pdp">
      <div className="tuti-pdp__shell">
        <button className="tuti-pdp__breadcrumb" onClick={() => goToShop(getCategoryForBack(product))} type="button">
          <ArrowLeft size={16} aria-hidden="true" />
          {meta.backLabel}
        </button>

        <section className="tuti-pdp__hero">
          <div className="tuti-pdp__media">
            <ProductVisual product={product} />
          </div>

          <section className="tuti-pdp__summary" aria-labelledby="tuti-pdp-title">
            <div className="tuti-pdp__badges">
              <Chip>{meta.label}</Chip>
              {releaseLabel ? <Chip>{releaseLabel}</Chip> : null}
              <Chip tone={product.stock === 0 ? "danger" : "success"}>{availabilityDetail}</Chip>
            </div>

            <h1 id="tuti-pdp-title">{product.name}</h1>

            <div className="tuti-pdp__seller">
              <span className="tuti-pdp__seller-mark" aria-hidden="true">{sellerInitials}</span>
              <div>
                <strong>{shop?.name || "Boutique seller"}</strong>
                <span><MapPin size={12} aria-hidden="true" /> {sellerLocation} {shop?.story ? "· Verified" : ""}</span>
              </div>
            </div>

            <div className="tuti-pdp__rating">
              <Stars score={score} />
              <strong>{score}</strong>
              <span>{reviewCount} review{reviewCount !== 1 ? "s" : ""}{verifiedCount > 0 ? ` · ${verifiedCount} verified` : ""}</span>
            </div>

            <div className="tuti-pdp__price">
              <strong>{formatCurrency(product.price)}</strong>
              {product.originalPrice ? <del>{formatCurrency(product.originalPrice)}</del> : null}
              {leadTimeLabel ? <span>{leadTimeLabel}</span> : null}
            </div>

            {(product.tags || []).length || shortPreview ? (
              <div className="tuti-pdp__summary-notes">
                {(product.tags || []).slice(0, 4).map((tag) => <Chip tone="soft" key={tag}>{tag}</Chip>)}
                {shortPreview ? <p>{shortPreview}</p> : null}
              </div>
            ) : null}

            <div className="tuti-pdp__purchase" ref={actionsRef}>
              <div className="tuti-pdp__quantity" role="group" aria-label="Quantity">
                <button
                  aria-label="Decrease quantity"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  type="button"
                >
                  <Minus size={16} aria-hidden="true" />
                </button>
                <span aria-live="polite">{quantity}</span>
                <button
                  aria-label="Increase quantity"
                  disabled={product.stock > 0 && quantity >= product.stock}
                  onClick={() => setQuantity((q) => (product.stock > 0 ? Math.min(product.stock, q + 1) : q + 1))}
                  type="button"
                >
                  <Plus size={16} aria-hidden="true" />
                </button>
              </div>
              <button
                className="tuti-pdp__cta"
                disabled={product.stock === 0}
                onClick={() => onAddToCart(product, quantity)}
                type="button"
              >
                <ShoppingBag size={18} aria-hidden="true" />
                {product.stock === 0 ? "Out of stock" : meta.cta}
              </button>
              <button className="tuti-pdp__secondary" disabled={product.stock === 0} onClick={addAndCheckout} type="button">
                <PackageCheck size={18} aria-hidden="true" />
                Continue order
              </button>
              {isAuthenticated() ? (
                <button
                  aria-label={isWishlisted(product.id) ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
                  aria-pressed={isWishlisted(product.id)}
                  className="tuti-pdp__icon-action"
                  onClick={() => toggleWishlist(product.id, product.name)}
                  type="button"
                >
                  <Heart size={18} fill={isWishlisted(product.id) ? "currentColor" : "none"} aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <div className="tuti-pdp__trust">
              <span><Truck size={14} aria-hidden="true" /> Cash on delivery</span>
              <span><MapPin size={14} aria-hidden="true" /> UAE boutique seller</span>
              <span><PackageCheck size={14} aria-hidden="true" /> Seller fulfilled</span>
              <span><ShieldCheck size={14} aria-hidden="true" /> Buyer support</span>
            </div>
            {isGift && shop ? (
              <p className="tuti-pdp__boutique-note">
                Prepared by {shop.name} · This boutique prepares the selected gift and options.
              </p>
            ) : null}
          </section>
        </section>

        <ProductInfo
          product={product}
          type={type}
          availabilityDetail={availabilityDetail}
          isPerfume={isPerfume}
          isCake={isCake}
          isGift={isGift}
        />

        {pairingProducts.length ? (
          <section className="tuti-pdp__related" aria-labelledby="tuti-pdp-pairing-title">
            <header className="tuti-pdp__section-head">
              <span>The Tuti pairing idea</span>
              <h2 id="tuti-pdp-pairing-title">{meta.pairingTitle}</h2>
            </header>
            <TutiProductGrid
              products={pairingProducts}
              getShop={getShop}
              variant="related"
              onAddToCart={onAddToCart}
              onViewProduct={onViewProduct}
              className="tuti-pdp__related-grid"
            />
          </section>
        ) : null}

        {related.length >= 2 ? (
          <section className="tuti-pdp__related" aria-labelledby="tuti-pdp-related-title">
            <header className="tuti-pdp__section-head">
              <span>You may also like</span>
              <h2 id="tuti-pdp-related-title">{meta.relatedLabel}</h2>
            </header>
            <TutiProductGrid
              products={related}
              getShop={getShop}
              variant="related"
              onAddToCart={onAddToCart}
              onViewProduct={onViewProduct}
              className="tuti-pdp__related-grid"
            />
          </section>
        ) : null}

        <section className="tuti-pdp__reviews" aria-labelledby="tuti-pdp-reviews-title">
          <div className="tuti-pdp__reviews-top">
            <div>
              <span>Customer reviews</span>
              <h2 id="tuti-pdp-reviews-title">Ratings &amp; Reviews</h2>
            </div>
            <div className="tuti-pdp__review-score">
              <strong>{score}</strong>
              <Stars score={score} size={15} />
              <span>{reviewCount} review{reviewCount !== 1 ? "s" : ""}{verifiedCount > 0 ? ` · ${verifiedCount} verified` : ""}</span>
            </div>
          </div>

          <div className="tuti-pdp__review-list">
            {productReviews.length ? productReviews.slice(0, 3).map((review) => (
              <article className="tuti-pdp__review-card" key={review.id}>
                <div>
                  <strong>{review.title}</strong>
                  <span><Star size={14} fill="currentColor" aria-hidden="true" /> {review.rating}</span>
                </div>
                <p>{review.body}</p>
                <small>{review.customer} · {review.verified ? "Verified purchase" : "Community review"}</small>
              </article>
            )) : (
              <p className="tuti-pdp__empty-review">No reviews yet. Be the first to share your experience after purchase.</p>
            )}
          </div>

          <details className="tuti-pdp__write-review">
            <summary>
              <span>Write a review</span>
              <small>Purchases are verified by Tuti after order completion.</small>
            </summary>
            <form className="tuti-pdp__review-form" onSubmit={submitCustomerReview}>
              <label>
                Your rating
                <StarPicker value={reviewDraft.rating} onChange={(rating) => setReviewDraft({ ...reviewDraft, rating })} />
              </label>
              <label>
                Review title
                <input
                  value={reviewDraft.title}
                  onChange={(event) => setReviewDraft({ ...reviewDraft, title: event.target.value })}
                  placeholder="Example: Long lasting oud"
                />
              </label>
              <label>
                Review
                <textarea
                  value={reviewDraft.body}
                  onChange={(event) => setReviewDraft({ ...reviewDraft, body: event.target.value })}
                  placeholder={reviewLabels.placeholder}
                  rows="4"
                />
              </label>
              <div className="tuti-pdp__review-aspects">
                <ReviewAspect label={reviewLabels.first} value={reviewDraft.scent} onChange={(scent) => setReviewDraft({ ...reviewDraft, scent })} />
                <ReviewAspect label={reviewLabels.second} value={reviewDraft.longevity} onChange={(longevity) => setReviewDraft({ ...reviewDraft, longevity })} />
                <ReviewAspect label={reviewLabels.third} value={reviewDraft.value} onChange={(value) => setReviewDraft({ ...reviewDraft, value })} />
              </div>
              <button className="tuti-pdp__cta" type="submit">
                <Send size={17} aria-hidden="true" />
                Submit rating
              </button>
              {reviewNote ? <p className="tuti-pdp__success">{reviewNote}</p> : null}
            </form>
          </details>
        </section>
      </div>

      {showStickyBar ? (
        <div className="tuti-pdp__sticky">
          <div>
            <strong>{product.name}</strong>
            <span>{formatCurrency(product.price)}</span>
          </div>
          <button
            className="tuti-pdp__cta"
            disabled={product.stock === 0}
            onClick={() => onAddToCart(product, quantity)}
            type="button"
          >
            <ShoppingBag size={16} aria-hidden="true" />
            {product.stock === 0 ? "Out of stock" : "Add to cart"}
          </button>
        </div>
      ) : null}
    </main>
  );
}
