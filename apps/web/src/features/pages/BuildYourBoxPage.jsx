import { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Gift,
  MessageSquare,
  Package,
  PackageCheck,
  ShoppingBag,
  Sparkles,
  Store,
  X,
} from "lucide-react";
import { BottleArt } from "@tuti/shared/components/BottleArt.jsx";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import buildBoxHeroImage from "../../assets/home-ch4-complete.png";

const OCCASION_OPTIONS = [
  {
    id: "birthday",
    label: "Birthday",
    suggestion: "Happy Birthday. Wishing you a beautiful day and something sweet to celebrate.",
  },
  {
    id: "eid",
    label: "Eid",
    suggestion: "Eid Mubarak. Wishing you joy, peace, and sweetness in every moment.",
  },
  {
    id: "wedding",
    label: "Wedding",
    suggestion: "Congratulations on your special day. Wishing you a beautiful beginning together.",
  },
  {
    id: "anniversary",
    label: "Anniversary",
    suggestion: "Happy Anniversary. Wishing you love, warmth, and a beautiful celebration.",
  },
  {
    id: "thank-you",
    label: "Thank You",
    suggestion: "Thank you for your kindness. I hope this gift brings a little joy to your day.",
  },
  {
    id: "just-because",
    label: "Just Because",
    suggestion: "Thinking of you and sending something thoughtful, simply because you deserve it.",
  },
];

function compactConfiguredProduct(product) {
  if (!product) return null;
  return {
    productId: product.id,
    name: product.name,
    shopId: product.shopId,
    category: product.category || "perfume",
    price: product.price,
    family: product.family,
    gender: product.gender,
    size: product.size,
    cakeType: product.cakeType,
    flavors: product.flavors,
    servings: product.servings,
    allergens: product.allergens,
    leadTimeDays: product.leadTimeDays,
  };
}

function normalizeOccasionLabel(occasionId) {
  return OCCASION_OPTIONS.find((option) => option.id === occasionId)?.label || "";
}

function getTreatLabel(product) {
  return product.category === "dessert" ? "Dessert" : "Cake";
}

function getLeadTimeLabel(days) {
  if (!days) return "";
  if (days === 1) return "Prepared with 24-hour notice";
  return `Prepared with ${days}-day notice`;
}

function buildPerfumeLine(product) {
  const notePyramid = product?.notePyramid || {};
  const notes = [
    ...(Array.isArray(notePyramid.top) ? notePyramid.top : []),
    ...(Array.isArray(product?.notes) ? product.notes : []),
  ].filter(Boolean);
  if (notes.length) return notes.slice(0, 3).join(", ");
  return product?.description || "Selected for gifting, layering, and memorable moments.";
}

function buildTreatLine(product) {
  if (Array.isArray(product?.flavors) && product.flavors.length) {
    return product.flavors.slice(0, 2).join(" · ");
  }
  return product?.cakeType || "Prepared for celebrations, milestones, and thoughtful gifting.";
}

function getAllergenHint(product) {
  if (!Array.isArray(product?.allergens) || !product.allergens.length) return "";
  if (product.allergens.includes("Nuts")) return "Contains nuts";
  return `Allergens: ${product.allergens.slice(0, 2).join(", ")}`;
}

function sortProducts(products, counterpartCounts = {}) {
  return [...products].sort((left, right) => {
    const pairableDiff = Number(counterpartCounts[right.shopId] || 0) - Number(counterpartCounts[left.shopId] || 0);
    if (pairableDiff !== 0) return pairableDiff;
    const ratingDiff = Number(right.rating || 0) - Number(left.rating || 0);
    if (ratingDiff !== 0) return ratingDiff;
    return String(left.name || "").localeCompare(String(right.name || ""));
  });
}

function TreatVisual({ product, compact = false }) {
  const className = compact ? "build-box-treat-art compact" : "build-box-treat-art";
  const treatClass = product?.category === "dessert"
    ? "build-box-treat-art-body build-box-treat-art-body--dessert"
    : "build-box-treat-art-body";

  return (
    <div
      className={className}
      style={{ "--treat-base": product?.color || "#d9c7a8", "--treat-accent": product?.accent || "#d7b56d" }}
      aria-hidden="true"
    >
      <span className="build-box-treat-plate" />
      <span className={treatClass} />
      <span className="build-box-treat-detail" />
    </div>
  );
}

function SelectionVisual({ product, compact = false }) {
  if (!product) return null;
  if (product.imagePath) {
    return (
      <div className={compact ? "build-box-choice-media compact" : "build-box-choice-media"}>
        <img src={product.imagePath} alt="" loading="lazy" decoding="async" />
      </div>
    );
  }
  if (product.category === "cake" || product.category === "dessert") {
    return (
      <div className={compact ? "build-box-choice-media compact" : "build-box-choice-media"}>
        <TreatVisual compact={compact} product={product} />
      </div>
    );
  }
  return (
    <div className={compact ? "build-box-choice-media compact" : "build-box-choice-media"}>
      <BottleArt compact={compact} product={product} />
    </div>
  );
}

function PreviewSlot({ label, product, title, subtitle, emptyText, compact = false }) {
  return (
    <div className={product ? "build-box-preview-slot active" : "build-box-preview-slot"}>
      <span className="build-box-preview-slot-label">{label}</span>
      {product ? (
        <div className="build-box-preview-slot-body">
          <SelectionVisual compact={compact} product={product} />
          <div className="build-box-preview-slot-copy">
            <strong>{title}</strong>
            {subtitle ? <span>{subtitle}</span> : null}
          </div>
        </div>
      ) : (
        <div className="build-box-preview-slot-empty">
          <span>{emptyText}</span>
        </div>
      )}
    </div>
  );
}

function GiftPreview({
  cardMessage,
  canAddBox,
  giftWrap,
  occasion,
  selectedPerfume,
  selectedShop,
  selectedTreat,
  totalPrice,
}) {
  const state = !selectedPerfume && !selectedTreat
    ? "empty"
    : selectedPerfume && !selectedTreat
      ? "perfume"
      : canAddBox && (cardMessage.trim() || giftWrap)
        ? "complete"
        : "paired";
  const occasionLabel = normalizeOccasionLabel(occasion);
  const packagingLabel = giftWrap ? "Gift wrapped" : "Tuti presentation";

  return (
    <section className="build-box-preview-card" aria-labelledby="build-box-preview-title">
      <div className="build-box-preview-head">
        <div>
          <span className="eyebrow">Live preview</span>
          <h2 id="build-box-preview-title">Your Tuti gift</h2>
        </div>
        <span className="build-box-preview-state" aria-live="polite">
          {state === "empty"
            ? "Waiting"
            : state === "perfume"
              ? "Perfume selected"
              : state === "paired"
                ? "Gift taking shape"
                : "Ready to present"}
        </span>
      </div>

      <div className={`build-box-preview-stage build-box-preview-stage--${state}`}>
        <div className="build-box-preview-ribbon" aria-hidden="true" />
        <div className="build-box-preview-box">
          <PreviewSlot
            label="Perfume"
            product={selectedPerfume}
            title={selectedPerfume?.name}
            subtitle={selectedPerfume ? `${selectedPerfume.family || "Boutique fragrance"} · ${formatCurrency(selectedPerfume.price)}` : ""}
            emptyText="Choose the scent that starts your gift."
          />
          <PreviewSlot
            label="Sweet"
            product={selectedTreat}
            title={selectedTreat?.name}
            subtitle={selectedTreat ? `${getTreatLabel(selectedTreat)} · ${formatCurrency(selectedTreat.price)}` : ""}
            emptyText="Add a cake or dessert from the same boutique."
          />
          <div className={state === "complete" ? "build-box-preview-note active" : "build-box-preview-note"}>
            <span className="build-box-preview-slot-label">Message card</span>
            {state === "complete" ? (
              <div className="build-box-preview-note-card">
                <strong>{occasionLabel || "Your gift card"}</strong>
                <p>{cardMessage.trim() || "A finishing note can still be added before checkout."}</p>
                <small>{packagingLabel}</small>
              </div>
            ) : (
              <div className="build-box-preview-slot-empty">
                <span>Your message is waiting to come together.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="build-box-preview-foot">
        <div className="build-box-preview-foot-copy">
          <strong>
            {occasionLabel ? `${occasionLabel} gift` : "Coordinated gift"}
          </strong>
          <span>
            {selectedShop?.name
              ? `Prepared by ${selectedShop.name}`
              : "Your gift is waiting to come together."}
          </span>
        </div>
        <strong className="build-box-preview-total">
          {totalPrice ? formatCurrency(totalPrice) : "Add items to see the total"}
        </strong>
      </div>
    </section>
  );
}

function SameBoutiqueStrip() {
  return (
    <section className="build-box-promise" aria-labelledby="build-box-promise-title">
      <div className="build-box-promise-copy">
        <span className="eyebrow">Why one boutique?</span>
        <h2 id="build-box-promise-title">Your gift arrives as one coordinated experience.</h2>
        <p>
          Your perfume and sweet are prepared by one Tuti seller, packaged together and handed over as one coordinated gift.
        </p>
      </div>
      <div className="build-box-promise-points" aria-label="Same boutique benefits">
        <span><Store size={16} /> One quality standard</span>
        <span><Package size={16} /> One package</span>
        <span><ShoppingBag size={16} /> One delivery</span>
      </div>
    </section>
  );
}

function OccasionSelector({ occasion, onSelect }) {
  return (
    <section className="build-box-occasion" aria-labelledby="build-box-occasion-title">
      <div className="build-box-occasion-head">
        <div>
          <span className="eyebrow">Optional occasion</span>
          <h2 id="build-box-occasion-title">Choose the moment you are gifting for.</h2>
        </div>
        {occasion ? (
          <button className="ghost-action compact" type="button" onClick={() => onSelect("")}>
            <X size={15} />
            Clear
          </button>
        ) : null}
      </div>
      <div className="build-box-occasion-grid" role="list" aria-label="Occasion options">
        {OCCASION_OPTIONS.map((option) => (
          <button
            key={option.id}
            className={occasion === option.id ? "build-box-occasion-chip active" : "build-box-occasion-chip"}
            type="button"
            aria-pressed={occasion === option.id}
            onClick={() => onSelect(option.id)}
          >
            <strong>{option.label}</strong>
            <span>{option.id === "thank-you" ? "Warm gratitude" : option.id === "just-because" ? "A thoughtful surprise" : "Suggested message available"}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ProductChoiceCard({
  active,
  helper,
  label,
  meta,
  onSelect,
  product,
  sellerName,
  summary,
}) {
  return (
    <button
      className={active ? "build-box-choice-card active" : "build-box-choice-card"}
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onSelect(product)}
    >
      <SelectionVisual product={product} />
      <div className="build-box-choice-copy">
        <div className="build-box-choice-copy-head">
          <span className="build-box-choice-eyebrow">{label}</span>
          {helper ? <span className="build-box-choice-helper">{helper}</span> : null}
        </div>
        <h3>{product.name}</h3>
        <p>{summary}</p>
        <div className="build-box-choice-meta">
          <span>{sellerName}</span>
          {meta.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <strong className="build-box-choice-price">{formatCurrency(product.price)}</strong>
      </div>
      <span className="build-box-choice-check" aria-hidden="true">
        {active ? <CheckCircle2 size={18} /> : <Check size={16} />}
      </span>
    </button>
  );
}

function EmptyState({ ctaLabel, onAction, text, title }) {
  return (
    <div className="build-box-empty-state" role="status" aria-live="polite">
      <PackageCheck size={20} />
      <strong>{title}</strong>
      <p>{text}</p>
      {onAction ? (
        <button className="secondary-action compact" type="button" onClick={onAction}>
          {ctaLabel}
        </button>
      ) : null}
    </div>
  );
}

function MessageSuggestion({ occasion, onUse }) {
  const suggestion = OCCASION_OPTIONS.find((option) => option.id === occasion)?.suggestion || "";
  if (!suggestion) return null;
  return (
    <div className="build-box-suggestion">
      <div>
        <strong>Suggested message</strong>
        <p>{suggestion}</p>
      </div>
      <button className="ghost-action compact" type="button" onClick={() => onUse(suggestion)}>
        Use suggestion
      </button>
    </div>
  );
}

export function BuildYourBoxPage({ products, getShop, onAddToCart, onNavigate }) {
  const perfumeSectionRef = useRef(null);
  const builderSectionRef = useRef(null);
  const treatSectionRef = useRef(null);
  const summarySectionRef = useRef(null);

  const [selectedPerfumeId, setSelectedPerfumeId] = useState("");
  const [selectedTreatId, setSelectedTreatId] = useState("");
  const [giftWrap, setGiftWrap] = useState(false);
  const [cardMessage, setCardMessage] = useState("");
  const [allergyNote, setAllergyNote] = useState("");
  const [occasion, setOccasion] = useState("");
  const [notice, setNotice] = useState("");

  const liveProducts = useMemo(
    () => products.filter((product) => product.status === "Live"),
    [products]
  );

  const perfumes = useMemo(
    () => liveProducts.filter((product) => !product.category || product.category === "perfume"),
    [liveProducts]
  );

  const treats = useMemo(
    () => liveProducts.filter((product) => product.category === "cake" || product.category === "dessert"),
    [liveProducts]
  );

  const treatCountsByShop = useMemo(() => {
    const counts = {};
    treats.forEach((product) => {
      counts[product.shopId] = (counts[product.shopId] || 0) + 1;
    });
    return counts;
  }, [treats]);

  const pairablePerfumes = useMemo(
    () => sortProducts(perfumes, treatCountsByShop),
    [perfumes, treatCountsByShop]
  );

  const selectedPerfume = pairablePerfumes.find((product) => product.id === selectedPerfumeId) || null;
  const selectedTreat = treats.find((product) => product.id === selectedTreatId) || null;

  const availableTreats = useMemo(() => {
    if (!selectedPerfume) return [];
    return sortProducts(
      treats.filter((product) => product.shopId === selectedPerfume.shopId)
    );
  }, [selectedPerfume, treats]);

  const selectedShop = selectedPerfume && selectedTreat && selectedPerfume.shopId === selectedTreat.shopId
    ? getShop(selectedPerfume.shopId)
    : selectedPerfume
      ? getShop(selectedPerfume.shopId)
      : selectedTreat
        ? getShop(selectedTreat.shopId)
        : null;

  const totalPrice = (selectedPerfume?.price || 0) + (selectedTreat?.price || 0);
  const leadTimeDays = Math.max(
    Number(selectedPerfume?.leadTimeDays || 0),
    Number(selectedTreat?.leadTimeDays || 0)
  );
  const canAddBox = Boolean(
    selectedPerfume && selectedTreat && selectedPerfume.shopId === selectedTreat.shopId
  );
  const hasAnyCompletePair = pairablePerfumes.some((product) => Number(treatCountsByShop[product.shopId] || 0) > 0);

  function resetNotice() {
    if (notice) setNotice("");
  }

  function scrollToRef(ref) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selectPerfume(product) {
    resetNotice();
    setSelectedPerfumeId(product.id);
    if (selectedTreat && selectedTreat.shopId !== product.shopId) {
      setSelectedTreatId("");
    }
  }

  function selectTreat(product) {
    resetNotice();
    setSelectedTreatId(product.id);
    if (selectedPerfume && selectedPerfume.shopId !== product.shopId) {
      setSelectedPerfumeId("");
    }
  }

  function changePerfume() {
    resetNotice();
    setSelectedPerfumeId("");
    setSelectedTreatId("");
    scrollToRef(perfumeSectionRef);
  }

  function clearAllSelections() {
    setNotice("");
    setSelectedPerfumeId("");
    setSelectedTreatId("");
    setGiftWrap(false);
    setCardMessage("");
    setAllergyNote("");
    setOccasion("");
    scrollToRef(builderSectionRef);
  }

  function applySuggestedMessage(nextMessage) {
    if (cardMessage.trim() && cardMessage.trim() !== nextMessage) {
      const shouldReplace = window.confirm("Replace your current message with the suggested one?");
      if (!shouldReplace) return;
    }
    resetNotice();
    setCardMessage(nextMessage);
  }

  function addConfiguredBox() {
    if (!canAddBox) return;
    const itemMessage = cardMessage.trim();
    const allergy = allergyNote.trim();
    const configuredBox = {
      id: "build-box",
      productName: "Build Your Box",
      name: "Build Your Box",
      category: "bundle",
      shopId: selectedPerfume.shopId,
      price: totalPrice,
      quantity: 1,
      bundledProductIds: [selectedPerfume.id, selectedTreat.id],
      includes: [selectedPerfume.name, selectedTreat.name],
      allergens: selectedTreat.allergens || [],
      leadTimeDays,
      metadata: {
        itemMessage,
        allergyNote: allergy,
        giftWrap,
      },
      configuration: {
        type: "build_your_box",
        version: 1,
        selectedPerfume: compactConfiguredProduct(selectedPerfume),
        selectedTreat: compactConfiguredProduct(selectedTreat),
        giftWrap,
        cardMessage: itemMessage,
        allergyNote: allergy,
        totalPrice,
      },
    };

    onAddToCart?.(configuredBox, 1, { separateLine: true });
    setNotice("Your gift has been added to cart.");
    scrollToRef(summarySectionRef);
  }

  const selectedSellerName = selectedShop?.name || "Selected boutique";
  const packagingLabel = giftWrap ? "Gift wrapped" : "Tuti presentation";
  const messageStatus = cardMessage.trim() ? "Message added" : "No message yet";
  const buildInstruction = !selectedPerfume
    ? "Choose a perfume to begin"
    : !selectedTreat
      ? "Add a cake or dessert to complete your gift"
      : "Your gift is ready to add to cart";

  return (
    <main className="page-shell build-box-page build-box-page--reconstructed">
      <section className="build-box-intro" aria-labelledby="build-box-title">
        <div className="build-box-intro-copy">
          <span className="eyebrow">A Tuti exclusive</span>
          <h1 id="build-box-title">One perfume. One sweet. One unforgettable gift.</h1>
          <p>
            Choose a fragrance and a cake or dessert from the same boutique. Add your message, select the finishing touches,
            and we will bring it together beautifully.
          </p>
          <div className="build-box-intro-actions">
            <button className="primary-action" type="button" onClick={() => scrollToRef(perfumeSectionRef)}>
              <Sparkles size={18} />
              Start with a perfume
            </button>
            <button className="ghost-action" type="button" onClick={() => onNavigate("/cart")}>
              <ShoppingBag size={18} />
              View cart
            </button>
          </div>
          {!hasAnyCompletePair ? (
            <div className="build-box-data-note" role="status" aria-live="polite">
              <strong>Pairings are being refreshed.</strong>
              <p>
                Some boutiques currently have perfumes without matching sweets. Explore the available options below,
                or browse curated gift sets while new pairings go live.
              </p>
              <button className="secondary-action compact" type="button" onClick={() => onNavigate("/shop?c=gift_box")}>
                Explore gift sets
              </button>
            </div>
          ) : null}
        </div>

        <div className="build-box-intro-media">
          <img src={buildBoxHeroImage} alt="Tuti gift box with perfume, cake and message card" />
        </div>
      </section>

      <SameBoutiqueStrip />
      <OccasionSelector
        occasion={occasion}
        onSelect={(nextOccasion) => {
          resetNotice();
          setOccasion(nextOccasion);
        }}
      />

      <section className="build-box-workspace" ref={builderSectionRef}>
        <div className="build-box-main">
          <section className="build-box-step" ref={perfumeSectionRef} aria-labelledby="build-box-step-perfume">
            <div className="build-box-step-head">
              <div>
                <span className="eyebrow">Step 1</span>
                <h2 id="build-box-step-perfume">Choose a perfume</h2>
                <p>Start with the scent. Your cake or dessert options will follow the same boutique.</p>
              </div>
              {selectedPerfume || selectedTreat ? (
                <button className="ghost-action compact" type="button" onClick={clearAllSelections}>
                  <X size={15} />
                  Start over
                </button>
              ) : null}
            </div>

            <div className="build-box-choice-grid" role="radiogroup" aria-label="Perfume selection">
              {pairablePerfumes.length ? pairablePerfumes.map((product) => {
                const sellerName = getShop(product.shopId)?.name || "Boutique seller";
                const pairCount = Number(treatCountsByShop[product.shopId] || 0);
                const helper = pairCount
                  ? `${pairCount} sweet${pairCount === 1 ? "" : "s"} available`
                  : "No sweets currently";
                const meta = [product.family || "Perfume", product.size, getLeadTimeLabel(product.leadTimeDays)].filter(Boolean);
                return (
                  <ProductChoiceCard
                    active={product.id === selectedPerfumeId}
                    helper={helper}
                    key={product.id}
                    label="Boutique fragrance"
                    meta={meta}
                    onSelect={selectPerfume}
                    product={product}
                    sellerName={sellerName}
                    summary={buildPerfumeLine(product)}
                  />
                );
              }) : (
                <EmptyState
                  title="No perfumes are currently available for Build a Box."
                  text="Please check back soon or browse the wider perfume catalogue."
                  ctaLabel="Browse perfumes"
                  onAction={() => onNavigate("/shop?c=perfume")}
                />
              )}
            </div>
          </section>

          <section className="build-box-step" ref={treatSectionRef} aria-labelledby="build-box-step-treat">
            <div className="build-box-step-head">
              <div>
                <span className="eyebrow">Step 2</span>
                <h2 id="build-box-step-treat">Add a cake or dessert</h2>
                <p>
                  {selectedPerfume
                    ? `Showing cakes and desserts available from ${selectedSellerName}.`
                    : "Choose a perfume first to unlock sweets from the same boutique."}
                </p>
              </div>
              {selectedPerfume ? (
                <button className="ghost-action compact" type="button" onClick={changePerfume}>
                  Change perfume
                </button>
              ) : null}
            </div>

            {!selectedPerfume ? (
              <EmptyState
                title="Choose a perfume to continue."
                text="Once you select the scent, we will show cakes and desserts from the same boutique."
                ctaLabel="Start with Step 1"
                onAction={() => scrollToRef(perfumeSectionRef)}
              />
            ) : availableTreats.length ? (
              <div className="build-box-choice-grid" role="radiogroup" aria-label="Cake and dessert selection">
                {availableTreats.map((product) => {
                  const sellerName = getShop(product.shopId)?.name || "Boutique seller";
                  const meta = [
                    getTreatLabel(product),
                    product.servings ? `Serves ${product.servings}` : "",
                    getLeadTimeLabel(product.leadTimeDays),
                    getAllergenHint(product),
                  ].filter(Boolean);
                  return (
                    <ProductChoiceCard
                      active={product.id === selectedTreatId}
                      helper={product.customMessageAvailable ? "Message-friendly" : ""}
                      key={product.id}
                      label={getTreatLabel(product)}
                      meta={meta}
                      onSelect={selectTreat}
                      product={product}
                      sellerName={sellerName}
                      summary={buildTreatLine(product)}
                    />
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No sweets are currently available from this boutique."
                text="Choose another perfume to see more cake and dessert options."
                ctaLabel="Change perfume"
                onAction={changePerfume}
              />
            )}
          </section>

          <section className="build-box-step" aria-labelledby="build-box-step-message">
            <div className="build-box-step-head">
              <div>
                <span className="eyebrow">Personal message and packaging</span>
                <h2 id="build-box-step-message">Add the finishing touches.</h2>
                <p>Your message is for the recipient. Preparation notes stay separate for the boutique team.</p>
              </div>
            </div>

            <div className="build-box-message-grid">
              <div className="build-box-message-card">
                <label className="build-box-field" htmlFor="build-box-message">
                  <span>Your message</span>
                  <textarea
                    id="build-box-message"
                    rows="5"
                    maxLength={240}
                    placeholder="Write the note your recipient will see."
                    value={cardMessage}
                    onChange={(event) => {
                      resetNotice();
                      setCardMessage(event.target.value);
                    }}
                  />
                </label>
                <div className="build-box-field-meta">
                  <span>{cardMessage.length}/240</span>
                  <span>{occasion ? `${normalizeOccasionLabel(occasion)} message idea available` : "Optional"}</span>
                </div>
                <MessageSuggestion occasion={occasion} onUse={applySuggestedMessage} />
              </div>

              <div className="build-box-preparation-card">
                <label className="build-box-field" htmlFor="build-box-allergy">
                  <span>Allergy or preparation note</span>
                  <input
                    id="build-box-allergy"
                    maxLength={240}
                    placeholder="Optional allergy or preparation note for the boutique"
                    value={allergyNote}
                    onChange={(event) => {
                      resetNotice();
                      setAllergyNote(event.target.value);
                    }}
                  />
                </label>

                <fieldset className="build-box-packaging">
                  <legend>Packaging</legend>
                  <label className={giftWrap ? "build-box-packaging-option" : "build-box-packaging-option active"}>
                    <input
                      checked={!giftWrap}
                      name="build-box-packaging"
                      type="radio"
                      onChange={() => {
                        resetNotice();
                        setGiftWrap(false);
                      }}
                    />
                    <span>
                      <strong>Tuti presentation</strong>
                      <small>Presented beautifully in the standard Tuti gift style.</small>
                    </span>
                  </label>

                  <label className={giftWrap ? "build-box-packaging-option active" : "build-box-packaging-option"}>
                    <input
                      checked={giftWrap}
                      name="build-box-packaging"
                      type="radio"
                      onChange={() => {
                        resetNotice();
                        setGiftWrap(true);
                      }}
                    />
                    <span>
                      <strong>Gift wrapped</strong>
                      <small>Add an extra wrapped presentation for the final handover.</small>
                    </span>
                  </label>
                </fieldset>
              </div>
            </div>
          </section>

          <section className="build-box-closing" aria-labelledby="build-box-next-steps">
            <span className="eyebrow">Reassurance and next steps</span>
            <h2 id="build-box-next-steps">We keep the final handover simple.</h2>
            <div className="build-box-closing-grid">
              <div>
                <strong>Cash on delivery</strong>
                <p>Review your gift at checkout and complete your order with straightforward delivery options.</p>
              </div>
              <div>
                <strong>Prepared with care</strong>
                <p>Your perfume, sweet, and note stay with one boutique so the presentation feels coordinated.</p>
              </div>
              <div>
                <strong>Need a ready-made option?</strong>
                <p>Browse curated gift sets if you want something complete without building from scratch.</p>
              </div>
            </div>
          </section>
        </div>

        <aside className="build-box-sidebar" ref={summarySectionRef}>
          <GiftPreview
            cardMessage={cardMessage}
            canAddBox={canAddBox}
            giftWrap={giftWrap}
            occasion={occasion}
            selectedPerfume={selectedPerfume}
            selectedShop={selectedShop}
            selectedTreat={selectedTreat}
            totalPrice={totalPrice}
          />

          <section className="build-box-summary-card" aria-labelledby="build-box-summary-title">
            <div className="build-box-summary-head">
              <div>
                <span className="eyebrow">Gift summary</span>
                <h2 id="build-box-summary-title">What is in your box</h2>
              </div>
              {canAddBox ? <span className="build-box-summary-ready">Ready</span> : null}
            </div>

            <div className="build-box-summary-lines">
              <div>
                <strong>Perfume</strong>
                <span>{selectedPerfume?.name || "Choose a perfume to begin"}</span>
              </div>
              <div>
                <strong>Sweet</strong>
                <span>{selectedTreat?.name || "Add a cake or dessert"}</span>
              </div>
              <div>
                <strong>Boutique</strong>
                <span>{selectedShop?.name || "Selected after both items match"}</span>
              </div>
              {occasion ? (
                <div>
                  <strong>Occasion</strong>
                  <span>{normalizeOccasionLabel(occasion)}</span>
                </div>
              ) : null}
              <div>
                <strong>Message</strong>
                <span>{messageStatus}</span>
              </div>
              <div>
                <strong>Packaging</strong>
                <span>{packagingLabel}</span>
              </div>
              {leadTimeDays ? (
                <div>
                  <strong>Preparation</strong>
                  <span>{getLeadTimeLabel(leadTimeDays)}</span>
                </div>
              ) : null}
            </div>

            <div className="build-box-total">
              <div className="summary-line">
                <span>Perfume</span>
                <strong>{formatCurrency(selectedPerfume?.price || 0)}</strong>
              </div>
              <div className="summary-line">
                <span>Sweet</span>
                <strong>{formatCurrency(selectedTreat?.price || 0)}</strong>
              </div>
              <div className="summary-line strong">
                <span>Total gift</span>
                <strong>{formatCurrency(totalPrice)}</strong>
              </div>
            </div>

            {canAddBox ? (
              <button
                className="primary-action full-width"
                type="button"
                onClick={addConfiguredBox}
                disabled={Boolean(notice)}
              >
                <ShoppingBag size={18} />
                {notice ? "Added to cart" : `Add gift to cart — ${formatCurrency(totalPrice)}`}
              </button>
            ) : (
              <div className="build-box-summary-instruction" role="status" aria-live="polite">
                <strong>{buildInstruction}</strong>
                <p>
                  {!selectedPerfume
                    ? "Start with a perfume, then choose a cake or dessert from the same boutique."
                    : "Your gift will become available once both items come from one boutique."}
                </p>
                <div className="build-box-summary-actions">
                  {!selectedPerfume ? (
                    <button className="secondary-action compact" type="button" onClick={() => scrollToRef(perfumeSectionRef)}>
                      Choose a perfume
                    </button>
                  ) : (
                    <button className="secondary-action compact" type="button" onClick={() => scrollToRef(treatSectionRef)}>
                      Add a sweet
                    </button>
                  )}
                </div>
              </div>
            )}

            {notice ? (
              <div className="build-box-success-card">
                <CheckCircle2 size={18} />
                <div>
                  <strong>{notice}</strong>
                  <p>Your configured gift stays together as one cart line item.</p>
                </div>
                <div className="build-box-success-actions">
                  <button className="secondary-action compact" type="button" onClick={() => onNavigate("/cart")}>
                    View cart
                  </button>
                  <button className="ghost-action compact" type="button" onClick={clearAllSelections}>
                    Build another gift
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </aside>
      </section>
    </main>
  );
}
