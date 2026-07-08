import { useMemo, useState } from "react";
import {
  ArrowRight,
  Baby,
  Briefcase,
  Cake,
  Check,
  Gem,
  Gift,
  Heart,
  HeartHandshake,
  Info,
  MoonStar,
  PackageCheck,
  Sparkles,
  Store,
  X,
} from "lucide-react";
import { BottleArt } from "@tuti/shared/components/BottleArt.jsx";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import buildBoxHeroImage from "../../assets/home-ch4-complete.png";
import "./build-gift.css";

// ─── Pricing ──────────────────────────────────────────────────────────────────

const VAT_RATE = 0.05;
const PRICE_GIFT_WRAP = 15;
const PRICE_CAKE_WRITING = 10;

// ─── Occasions ────────────────────────────────────────────────────────────────

const OCCASIONS = [
  { id: "birthday",    label: "Birthday",      hint: "Celebrate the day",         icon: Cake,           keywords: ["birthday", "celebration", "bday"] },
  { id: "graduation",  label: "Graduation",    hint: "Mark the milestone",        icon: Sparkles,       keywords: ["graduation", "graduate", "congrats", "achievement"] },
  { id: "anniversary", label: "Anniversary",   hint: "Love and milestones",       icon: HeartHandshake, keywords: ["anniversary", "love", "romance"] },
  { id: "thank-you",   label: "Thank You",     hint: "A genuine gesture",         icon: Heart,          keywords: ["thank", "gratitude", "appreciation"] },
  { id: "corporate",   label: "Corporate",     hint: "Professional gifting",      icon: Briefcase,      keywords: ["corporate", "business", "professional", "office"] },
  { id: "new-baby",    label: "New Baby",      hint: "Welcome the little one",    icon: Baby,           keywords: ["baby", "newborn", "birth", "infant"] },
  { id: "eid",         label: "Eid & Ramadan", hint: "Celebrate the season",      icon: MoonStar,       keywords: ["eid", "ramadan", "mubarak"] },
  { id: "apology",     label: "Apology",       hint: "Thoughtful, flowers-style", icon: Gift,           keywords: ["apology", "sorry", "forgive", "floral", "flower"] },
];

// ─── Gift types ───────────────────────────────────────────────────────────────

const GIFT_TYPES = [
  {
    id: "perfume",
    label: "Perfume Gift",
    icon: Gem,
    copy: "Find perfumes and perfume boxes from perfume boutiques.",
    categories: ["perfume"],
  },
  {
    id: "cake",
    label: "Cake & Dessert Gift",
    icon: Cake,
    copy: "Choose cakes, dessert sets, and celebration treats.",
    categories: ["cake", "dessert"],
  },
  {
    id: "gift-box",
    label: "Ready Gift Box",
    icon: Gift,
    copy: "Explore graduation gifts, flowers, chocolate boxes, and curated occasion packages.",
    categories: ["gift_box", "bundle"],
  },
];

// ─── Filtering + scoring ──────────────────────────────────────────────────────

function filterByType(products, typeId) {
  const typeConf = GIFT_TYPES.find((t) => t.id === typeId);
  if (!typeConf) return [];
  return products.filter((p) => typeConf.categories.includes(p.category));
}

function scoreForOccasion(product, occasionId) {
  const occ = OCCASIONS.find((o) => o.id === occasionId);
  if (!occ) return 0;
  const haystack = [
    ...(Array.isArray(product.occasionTags) ? product.occasionTags : []),
    ...(Array.isArray(product.tags) ? product.tags : []),
    product.family || "",
    product.productType || "",
    product.name || "",
    product.description || "",
  ].join(" ").toLowerCase();
  let score = 0;
  for (const kw of occ.keywords) {
    if (haystack.includes(kw)) score += 2;
  }
  if (occasionId === "eid" && (haystack.includes("oud") || haystack.includes("oriental") || haystack.includes("arabic"))) {
    score += 1;
  }
  return score;
}

function sortRecommendations(products, occasionId) {
  if (!occasionId) return products;
  return [...products].sort((a, b) => {
    const diff = scoreForOccasion(b, occasionId) - scoreForOccasion(a, occasionId);
    if (diff !== 0) return diff;
    return Number(b.rating || 0) - Number(a.rating || 0);
  });
}

// ─── Thumbnails ───────────────────────────────────────────────────────────────

function TreatThumb({ product }) {
  return (
    <div
      className="build-box-treat-art compact"
      style={{ "--treat-base": product?.color || "#d9c7a8", "--treat-accent": product?.accent || "#d7b56d" }}
      aria-hidden="true"
    >
      <span className="build-box-treat-plate" />
      <span className={product?.category === "dessert" ? "build-box-treat-art-body build-box-treat-art-body--dessert" : "build-box-treat-art-body"} />
      <span className="build-box-treat-detail" />
    </div>
  );
}

function ProductThumb({ product }) {
  if (product.imagePath) {
    return <img src={product.imagePath} alt="" loading="lazy" decoding="async" />;
  }
  if (product.category === "cake" || product.category === "dessert") {
    return <TreatThumb product={product} />;
  }
  return <BottleArt product={product} compact />;
}

// ─── Product card (multi-selectable) ─────────────────────────────────────────

function ProductCard({ getShop, isDisabled, isSelected, onToggle, product }) {
  const shop = getShop(product.shopId);
  const tags = [
    product.family,
    product.size,
    product.cakeType,
    product.servings ? `Serves ${product.servings}` : "",
    Array.isArray(product.flavors) && product.flavors.length ? product.flavors.slice(0, 2).join(" · ") : "",
  ].filter(Boolean).slice(0, 3);

  function handleToggle() {
    if (!isDisabled) onToggle(product);
  }

  return (
    <div className={`tuti-build-gift__product${isSelected ? " is-selected" : ""}${isDisabled ? " is-disabled" : ""}`}>
      <div className="tuti-build-gift__product-thumb">
        <ProductThumb product={product} />
        {isSelected ? (
          <div className="tuti-build-gift__product-selected-badge" aria-hidden="true">
            <Check size={10} strokeWidth={3.5} />
          </div>
        ) : null}
        {isDisabled ? (
          <div className="tuti-build-gift__product-locked-label" aria-hidden="true">
            Locked
          </div>
        ) : null}
      </div>
      <div className="tuti-build-gift__product-body">
        {shop?.name ? (
          <div className="tuti-build-gift__product-boutique">{shop.name}</div>
        ) : null}
        <div className="tuti-build-gift__product-name">{product.name}</div>
        {product.description ? (
          <div className="tuti-build-gift__product-desc">{product.description}</div>
        ) : null}
        {tags.length ? (
          <div className="tuti-build-gift__product-tags">
            {tags.map((t) => (
              <span className="tuti-build-gift__product-tag" key={t}>{t}</span>
            ))}
          </div>
        ) : null}
        <div className="tuti-build-gift__product-price">{formatCurrency(product.price)}</div>
      </div>
      <div className="tuti-build-gift__product-actions">
        <button
          className={`tuti-build-gift__product-toggle${isSelected ? " is-selected" : ""}`}
          type="button"
          onClick={handleToggle}
          disabled={isDisabled}
        >
          {isSelected ? (
            <><X size={11} aria-hidden="true" /> Remove</>
          ) : (
            <>Select for gift</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

export function BuildYourBoxPage({ onAddToCart, products, getShop, onNavigate }) {
  const [selectedOccasion, setSelectedOccasion] = useState("");
  const [selectedType, setSelectedType]         = useState("");
  const [selectedItems, setSelectedItems]       = useState([]);
  const [giftMessage, setGiftMessage]           = useState("");
  const [cakeWriting, setCakeWriting]           = useState("");
  const [allergyNote, setAllergyNote]           = useState("");
  const [giftWrap, setGiftWrap]                 = useState(false);
  const [addedToCart, setAddedToCart]           = useState(false);

  const liveProducts = useMemo(
    () => products.filter((p) => p.status === "Live"),
    [products]
  );

  const recommendations = useMemo(() => {
    if (!selectedType) return [];
    const byType = filterByType(liveProducts, selectedType);
    return sortRecommendations(byType, selectedOccasion);
  }, [liveProducts, selectedType, selectedOccasion]);

  const occasionLabel = OCCASIONS.find((o) => o.id === selectedOccasion)?.label || "";
  const typeLabel     = GIFT_TYPES.find((t) => t.id === selectedType)?.label || "";
  const isCakeType    = selectedType === "cake";

  // First selected item's shopId locks the boutique for the whole gift
  const lockedShopId = selectedItems.length > 0 ? selectedItems[0].shopId : null;
  const lockedShop   = lockedShopId ? getShop(lockedShopId) : null;

  // Pricing
  const itemsSubtotal = selectedItems.reduce((sum, p) => sum + (p.price || 0), 0);
  const customizationSubtotal =
    (giftWrap ? PRICE_GIFT_WRAP : 0) +
    (isCakeType && cakeWriting.trim() ? PRICE_CAKE_WRITING : 0);
  const subtotalBeforeVat = itemsSubtotal + customizationSubtotal;
  const vatAmount  = Math.round(subtotalBeforeVat * VAT_RATE);
  const totalPrice = subtotalBeforeVat + vatAmount;

  function pickOccasion(id) {
    setSelectedOccasion(id);
    setSelectedType("");
    setSelectedItems([]);
    setAddedToCart(false);
  }

  function pickType(id) {
    setSelectedType(id);
    setSelectedItems([]);
    setAddedToCart(false);
    if (id !== "cake") {
      setCakeWriting("");
      setAllergyNote("");
    }
  }

  function toggleItem(product) {
    setSelectedItems((prev) => {
      const idx = prev.findIndex((p) => p.id === product.id);
      if (idx >= 0) return prev.filter((p) => p.id !== product.id);
      // Reject cross-boutique additions at state level (defence-in-depth; UI also disables the button)
      const lockedId = prev.length > 0 ? prev[0].shopId : null;
      if (lockedId && product.shopId !== lockedId) return prev;
      return [...prev, product];
    });
    setAddedToCart(false);
  }

  function clearAll() {
    setSelectedOccasion("");
    setSelectedType("");
    setSelectedItems([]);
    setGiftMessage("");
    setCakeWriting("");
    setAllergyNote("");
    setGiftWrap(false);
    setAddedToCart(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addCustomizedGiftToCart() {
    if (!selectedItems.length) return;
    const timestamp = Date.now();
    const maxLead = selectedItems.reduce((m, p) => Math.max(m, p.leadTimeDays || 0), 0);
    const cartItem = {
      id: `build-gift-${timestamp}`,
      cartLineId: `build-gift-${timestamp}`,
      name: "Customized gift",
      category: "bundle",
      price: totalPrice,
      quantity: 1,
      shopId: lockedShop?.id || null,
      shopName: lockedShop?.name || null,
      sellerName: lockedShop?.name || null,
      bundledProductIds: selectedItems.map((p) => p.id),
      includes: selectedItems.map((p) => p.name),
      allergens: [...new Set(selectedItems.flatMap((p) => p.allergens || []))],
      ...(maxLead > 0 ? { leadTimeDays: maxLead } : {}),
      metadata: {
        source: "build_gift",
        occasion: selectedOccasion,
        occasionLabel,
        giftType: selectedType,
        giftTypeLabel: typeLabel,
        giftMessage: giftMessage.trim(),
        giftWrap,
        ...(isCakeType ? { cakeWriting: cakeWriting.trim(), allergyNote: allergyNote.trim() } : {}),
        customizationPrice: customizationSubtotal,
        vatAmount,
        itemsSubtotal,
        totalPrice,
      },
      configuration: {
        type: "build_gift",
        version: 1,
        occasion: selectedOccasion,
        occasionLabel,
        giftType: selectedType,
        giftTypeLabel: typeLabel,
        selectedItems: selectedItems.map((p) => ({
          productId: p.id,
          name: p.name,
          price: p.price,
          shopId: p.shopId,
          category: p.category,
        })),
        giftMessage: giftMessage.trim(),
        giftWrap,
        ...(isCakeType ? { cakeWriting: cakeWriting.trim(), allergyNote: allergyNote.trim() } : {}),
        customizationPrice: customizationSubtotal,
        vatAmount,
        itemsSubtotal,
        totalPrice,
      },
    };
    onAddToCart?.(cartItem, 1, { separateLine: true });
    setAddedToCart(true);
  }

  return (
    <main className="page-shell tuti-build-gift">

      {/* ── Hero ── */}
      <div className="tuti-build-gift__hero" aria-labelledby="build-gift-title">
        <div className="tuti-build-gift__hero-inner">
          <div>
            <span className="tuti-build-gift__hero-eyebrow">A Tuti exclusive</span>
            <h1 id="build-gift-title">Build a Gift</h1>
            <p className="tuti-build-gift__hero-sub">
              Choose the occasion, pick the gift style, select items, and personalize.
              Your customized gift goes to cart with all your preferences.
            </p>
            <p className="tuti-build-gift__hero-note">
              <Store size={13} aria-hidden="true" />
              Each boutique prepares its own gifts and packaging.
            </p>
          </div>
          <div className="tuti-build-gift__hero-img" aria-hidden="true">
            <img src={buildBoxHeroImage} alt="" />
          </div>
        </div>
      </div>

      {/* ── Builder workspace ── */}
      <div className="tuti-build-gift__workspace">

        {/* ── Left: one connected builder card ── */}
        <div className="tuti-build-gift__workspace-left">
          <div className="tuti-build-gift__builder">

            {/* Controls: occasion chips + type cards on cream background */}
            <div className="tuti-build-gift__builder-controls">

              {/* Occasion chips */}
              <div className="tuti-build-gift__chips-group">
                <div className="tuti-build-gift__chips-label">
                  <span className="tuti-build-gift__step-badge">1</span>
                  Choose occasion
                </div>
                <div className="tuti-build-gift__chips" role="radiogroup" aria-label="Occasion">
                  {OCCASIONS.map((occ) => {
                    const Icon = occ.icon;
                    return (
                      <button
                        key={occ.id}
                        className={`tuti-build-gift__chip${selectedOccasion === occ.id ? " is-selected" : ""}`}
                        type="button"
                        role="radio"
                        aria-checked={selectedOccasion === occ.id}
                        onClick={() => pickOccasion(occ.id)}
                      >
                        <Icon size={12} strokeWidth={2} aria-hidden="true" />
                        {occ.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Type cards */}
              <div className={`tuti-build-gift__chips-group${!selectedOccasion ? " is-locked" : ""}`}>
                <div className="tuti-build-gift__chips-label">
                  <span className="tuti-build-gift__step-badge">2</span>
                  Gift type
                  {!selectedOccasion ? (
                    <span className="tuti-build-gift__chips-hint"> — choose an occasion first</span>
                  ) : null}
                </div>
                <div className="tuti-build-gift__types" role="radiogroup" aria-label="Gift type">
                  {GIFT_TYPES.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        className={`tuti-build-gift__type-card${selectedType === t.id ? " is-selected" : ""}`}
                        type="button"
                        role="radio"
                        aria-checked={selectedType === t.id}
                        onClick={() => pickType(t.id)}
                        disabled={!selectedOccasion}
                      >
                        <div className="tuti-build-gift__type-icon" aria-hidden="true">
                          <Icon size={17} strokeWidth={1.75} />
                        </div>
                        <div className="tuti-build-gift__type-label">{t.label}</div>
                        <div className="tuti-build-gift__type-copy">{t.copy}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Products area */}
            <div className={`tuti-build-gift__builder-products${!selectedType ? " is-locked" : ""}`}>
              <div className="tuti-build-gift__products-header">
                <div className="tuti-build-gift__products-label">
                  <span className="tuti-build-gift__step-badge">3</span>
                  {selectedType ? typeLabel : "Select items"}
                  {selectedType && occasionLabel ? (
                    <span className="tuti-build-gift__products-context"> · {occasionLabel}</span>
                  ) : null}
                  {selectedType && lockedShopId ? (
                    <span className="tuti-build-gift__products-context"> · {lockedShop?.name}</span>
                  ) : null}
                </div>
                <div className="tuti-build-gift__products-meta">
                  {recommendations.length > 0 ? (
                    <span className="tuti-build-gift__recs-count">
                      {recommendations.length} available
                    </span>
                  ) : null}
                  {selectedItems.length > 0 ? (
                    <span className="tuti-build-gift__recs-selected">
                      {selectedItems.length} selected
                    </span>
                  ) : null}
                </div>
              </div>

              {selectedType && recommendations.length > 0 ? (
                <div className="tuti-build-gift__product-grid">
                  {recommendations.map((product) => {
                    const isSelected = selectedItems.some((p) => p.id === product.id);
                    const isDisabled = lockedShopId !== null && product.shopId !== lockedShopId && !isSelected;
                    return (
                      <ProductCard
                        key={product.id}
                        getShop={getShop}
                        isDisabled={isDisabled}
                        isSelected={isSelected}
                        onToggle={toggleItem}
                        product={product}
                      />
                    );
                  })}
                </div>
              ) : selectedType ? (
                <div className="tuti-build-gift__product-grid">
                  <div className="tuti-build-gift__empty">
                    <div className="tuti-build-gift__empty-icon">
                      <PackageCheck size={18} />
                    </div>
                    <strong>No {typeLabel.toLowerCase()} products yet</strong>
                    <p>
                      New boutiques and products are added regularly. Browse the full shop while new gifts go live.
                    </p>
                    <button
                      className="tuti-build-gift__empty-link"
                      type="button"
                      onClick={() => onNavigate?.("/shop")}
                    >
                      Browse all gifts <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="tuti-build-gift__product-grid">
                  <div className="tuti-build-gift__empty">
                    <div className="tuti-build-gift__empty-icon">
                      <Gift size={18} />
                    </div>
                    <strong>Choose a gift type to browse</strong>
                    <p>Select occasion and gift type above to see matching products from our boutiques.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: unified selection summary + personalization ── */}
        <aside className="tuti-build-gift__summary" aria-label="Gift selection and personalization">

          {/* Navy gift summary */}
          <div className="tuti-build-gift__intent">
            <div className="tuti-build-gift__intent-head">
              <span className="tuti-build-gift__intent-eyebrow">Your gift</span>
              <h2>Gift builder</h2>
            </div>
            <div className="tuti-build-gift__intent-rows" aria-live="polite">
              <div className="tuti-build-gift__intent-row">
                <span className="tuti-build-gift__intent-lbl">Occasion</span>
                <span className={`tuti-build-gift__intent-val${!occasionLabel ? " is-dim" : ""}`}>
                  {occasionLabel || "Not chosen yet"}
                </span>
              </div>
              <div className="tuti-build-gift__intent-row">
                <span className="tuti-build-gift__intent-lbl">Gift type</span>
                <span className={`tuti-build-gift__intent-val${!typeLabel ? " is-dim" : ""}`}>
                  {typeLabel || "Not chosen yet"}
                </span>
              </div>
              <div className="tuti-build-gift__intent-row">
                <span className="tuti-build-gift__intent-lbl">Boutique</span>
                <span className={`tuti-build-gift__intent-val${!lockedShop ? " is-dim" : ""}`}>
                  {lockedShop?.name || "Select items first"}
                </span>
              </div>
              <div className="tuti-build-gift__intent-row">
                <span className="tuti-build-gift__intent-lbl">Items</span>
                <span className={`tuti-build-gift__intent-val${!selectedItems.length ? " is-dim" : ""}`}>
                  {selectedItems.length ? `${selectedItems.length} selected` : "None yet"}
                </span>
              </div>
            </div>

            {selectedItems.length > 0 ? (
              <div className="tuti-build-gift__selected-items" aria-label="Selected items">
                {selectedItems.map((item) => (
                  <div className="tuti-build-gift__selected-item" key={item.id}>
                    <span className="tuti-build-gift__selected-item-name">{item.name}</span>
                    <span className="tuti-build-gift__selected-item-price">{formatCurrency(item.price)}</span>
                    <button
                      className="tuti-build-gift__selected-item-remove"
                      type="button"
                      onClick={() => toggleItem(item)}
                      aria-label={`Remove ${item.name}`}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="tuti-build-gift__selected-empty">
                Select products from the grid to add them to your gift.
              </div>
            )}

            <div className="tuti-build-gift__boutique-note">
              <Info size={13} aria-hidden="true" />
              All selected items must be from the same boutique.
            </div>
          </div>

          {/* Personalize + pricing + CTA */}
          <div className={`tuti-build-gift__personalize${!selectedItems.length ? " is-locked" : ""}`}>
            <div className="tuti-build-gift__personalize-head">
              <span className="tuti-build-gift__personalize-eyebrow">Personalize</span>
              <h3>Add finishing touches</h3>
            </div>
            <div className="tuti-build-gift__personalize-body">

              {/* Gift message */}
              <div className="tuti-build-gift__field">
                <label className="tuti-build-gift__field-label" htmlFor="build-gift-message">
                  Gift message <span className="tuti-build-gift__field-hint">(free · seen by recipient)</span>
                </label>
                <textarea
                  className="tuti-build-gift__textarea"
                  id="build-gift-message"
                  maxLength={240}
                  placeholder="Write the note your recipient will see…"
                  value={giftMessage}
                  onChange={(e) => setGiftMessage(e.target.value)}
                />
                <div className="tuti-build-gift__char-count">{giftMessage.length} / 240</div>
              </div>

              {/* Packaging */}
              <div className="tuti-build-gift__field">
                <div className="tuti-build-gift__field-label" id="bg-packaging">Packaging</div>
                <div className="tuti-build-gift__packaging-opts" role="radiogroup" aria-labelledby="bg-packaging">
                  <label className={`tuti-build-gift__packaging-opt${!giftWrap ? " is-active" : ""}`}>
                    <input
                      checked={!giftWrap}
                      name="build-gift-packaging"
                      type="radio"
                      onChange={() => setGiftWrap(false)}
                    />
                    <span>
                      <strong>Standard presentation</strong>
                      <small>Boutique gift packaging, included.</small>
                    </span>
                    <span className="tuti-build-gift__packaging-price">Free</span>
                  </label>
                  <label className={`tuti-build-gift__packaging-opt${giftWrap ? " is-active" : ""}`}>
                    <input
                      checked={giftWrap}
                      name="build-gift-packaging"
                      type="radio"
                      onChange={() => setGiftWrap(true)}
                    />
                    <span>
                      <strong>Gift wrapped</strong>
                      <small>Extra wrapping and ribbon.</small>
                    </span>
                    <span className="tuti-build-gift__packaging-price">+AED {PRICE_GIFT_WRAP}</span>
                  </label>
                </div>
              </div>

              {/* Cake-specific fields */}
              {isCakeType ? (
                <>
                  <hr className="tuti-build-gift__cake-divider" />
                  <div className="tuti-build-gift__field">
                    <div className="tuti-build-gift__cake-badge">
                      <Cake size={11} aria-hidden="true" /> Cake &amp; dessert options
                    </div>
                    <label className="tuti-build-gift__field-label" htmlFor="build-gift-writing">
                      Cake writing <span className="tuti-build-gift__field-hint">(+AED {PRICE_CAKE_WRITING} if filled)</span>
                    </label>
                    <input
                      className="tuti-build-gift__input"
                      id="build-gift-writing"
                      maxLength={80}
                      placeholder="E.g. Happy Birthday Sarah"
                      value={cakeWriting}
                      onChange={(e) => setCakeWriting(e.target.value)}
                    />
                  </div>
                  <div className="tuti-build-gift__field">
                    <label className="tuti-build-gift__field-label" htmlFor="build-gift-allergy">
                      Allergy note <span className="tuti-build-gift__field-hint">(free · seen only by boutique)</span>
                    </label>
                    <input
                      className="tuti-build-gift__input"
                      id="build-gift-allergy"
                      maxLength={240}
                      placeholder="Any allergies or preparation requests"
                      value={allergyNote}
                      onChange={(e) => setAllergyNote(e.target.value)}
                    />
                  </div>
                </>
              ) : null}

              {/* Price summary */}
              {selectedItems.length > 0 ? (
                <div className="tuti-build-gift__price-summary">
                  <div className="tuti-build-gift__price-row">
                    <span>Items subtotal</span>
                    <span>{formatCurrency(itemsSubtotal)}</span>
                  </div>
                  {giftWrap ? (
                    <div className="tuti-build-gift__price-row">
                      <span>Gift wrapping</span>
                      <span>{formatCurrency(PRICE_GIFT_WRAP)}</span>
                    </div>
                  ) : null}
                  {isCakeType && cakeWriting.trim() ? (
                    <div className="tuti-build-gift__price-row">
                      <span>Cake writing</span>
                      <span>{formatCurrency(PRICE_CAKE_WRITING)}</span>
                    </div>
                  ) : null}
                  <div className="tuti-build-gift__price-row is-vat">
                    <span>VAT (5%)</span>
                    <span>{formatCurrency(vatAmount)}</span>
                  </div>
                  <div className="tuti-build-gift__price-row is-total">
                    <span>Total</span>
                    <span>{formatCurrency(totalPrice)}</span>
                  </div>
                </div>
              ) : null}

              {/* CTA */}
              {addedToCart ? (
                <div className="tuti-build-gift__success">
                  <PackageCheck size={15} aria-hidden="true" />
                  Gift added to cart
                  <button
                    className="tuti-build-gift__success-link"
                    type="button"
                    onClick={() => onNavigate?.("/cart")}
                  >
                    View cart →
                  </button>
                </div>
              ) : (
                <button
                  className="tuti-build-gift__add-btn"
                  type="button"
                  disabled={!selectedItems.length}
                  onClick={addCustomizedGiftToCart}
                >
                  <Gift size={15} aria-hidden="true" />
                  Add customized gift to cart
                </button>
              )}
            </div>
          </div>

          {/* Start over */}
          {(selectedOccasion || selectedType || selectedItems.length > 0) ? (
            <button
              className="tuti-build-gift__ghost-btn"
              type="button"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={clearAll}
            >
              <X size={13} /> Start over
            </button>
          ) : null}
        </aside>
      </div>

      {/* ── Closing reassurance strip ── */}
      <div className="tuti-build-gift__assurance" aria-label="Build a Gift reassurance">
        <span>Prepared by one boutique</span>
        <span>Customization saved to cart</span>
        <span>VAT shown before checkout</span>
      </div>
    </main>
  );
}
