import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronLeft, Search, Sparkles } from "lucide-react";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import { TutiBadge, TutiButton, TutiEmptyState } from "../../../ui/customer/primitives/index.js";
import { resolveShop } from "../../../ui/customer/commerce/commerceUtils.js";
import "./fragrance-finder.css";

const MOOD_OPTIONS = [
  { value: "fresh", label: "Fresh & clean", notes: ["Citrus", "Musk", "White tea"], helper: "Crisp, polished, effortless.", keywords: ["citrus", "fresh", "aquatic", "green", "musk", "clean", "tea", "neroli", "bergamot", "mint"] },
  { value: "warm", label: "Warm & elegant", notes: ["Amber", "Oud", "Soft woods"], helper: "Refined, evening-ready, quietly luxurious.", keywords: ["amber", "oud", "woody", "musk", "warm", "wood", "resin"] },
  { value: "sweet", label: "Sweet & memorable", notes: ["Vanilla", "Rose", "Tonka"], helper: "Soft sweetness with a signature trail.", keywords: ["vanilla", "gourmand", "floral", "amber", "sweet", "rose", "date", "tonka"] },
  { value: "deep", label: "Deep & mysterious", notes: ["Oud", "Spice", "Leather"], helper: "Bold, textured, and made for night gifting.", keywords: ["oud", "smoky", "spicy", "leather", "amber", "resin", "strong"] },
  { value: "soft", label: "Soft & everyday", notes: ["Musk", "Iris", "Clean florals"], helper: "Quiet luxury for daily rituals.", keywords: ["musk", "floral", "clean", "powdery", "citrus", "soft", "iris"] },
];

const OCCASION_OPTIONS = [
  { value: "everyday", label: "Everyday", notes: ["Clean", "Easy", "Polished"], helper: "A scent that feels effortless from morning to evening.", keywords: ["daily", "everyday", "morning", "clean"] },
  { value: "office", label: "Office", notes: ["Subtle", "Fresh", "Professional"], helper: "Present and refined without overwhelming the room.", keywords: ["office", "polished", "fresh", "clean"] },
  { value: "evening", label: "Evening", notes: ["Amber", "Oud", "Warm woods"], helper: "A richer trail for dinners, events, and late plans.", keywords: ["evening", "warm", "amber", "oud", "strong"] },
  { value: "wedding", label: "Wedding", notes: ["Rose", "Floral", "Elegant"], helper: "Romantic, memorable, and photo-ready.", keywords: ["wedding", "floral", "rose", "elegant"] },
  { value: "gift", label: "Gift", notes: ["Signature", "Unisex", "Compliment"], helper: "A safe but special boutique choice.", keywords: ["gift", "compliment", "unisex", "signature"] },
  { value: "ramadan-eid", label: "Ramadan / Eid", notes: ["Oud", "Amber", "Oriental"], helper: "Warm, generous, and celebration-ready.", keywords: ["eid", "ramadan", "oud", "amber", "oriental"] },
];

const FAMILY_OPTIONS = [
  { value: "oud", label: "Oud", notes: ["Rich", "Smoky", "Precious"], helper: "A deep UAE gifting classic.", keywords: ["oud"] },
  { value: "musk", label: "Musk", notes: ["Clean", "Soft", "Skin-like"], helper: "A polished everyday signature.", keywords: ["musk"] },
  { value: "floral", label: "Floral", notes: ["Rose", "Petals", "Elegant"], helper: "Romantic and easy to gift.", keywords: ["floral"] },
  { value: "amber", label: "Amber", notes: ["Warm", "Golden", "Resin"], helper: "Smooth warmth with evening depth.", keywords: ["amber"] },
  { value: "citrus", label: "Citrus", notes: ["Bright", "Fresh", "Sparkling"], helper: "Crisp and energetic.", keywords: ["citrus"] },
  { value: "vanilla", label: "Vanilla", notes: ["Creamy", "Soft", "Sweet"], helper: "Comforting without feeling childish.", keywords: ["vanilla"] },
  { value: "woody", label: "Woody", notes: ["Cedar", "Sandalwood", "Dry"], helper: "Structured and quietly expensive.", keywords: ["woody", "wood"] },
  { value: "spicy", label: "Spicy", notes: ["Saffron", "Pepper", "Warm"], helper: "Distinctive, bold, and memorable.", keywords: ["spicy"] },
];

const INTENSITY_OPTIONS = [
  { value: "light", label: "Light", notes: ["Airy", "Close", "Soft"], helper: "A gentle scent that stays close to skin.", keywords: ["light", "soft", "fresh", "4-6"] },
  { value: "balanced", label: "Balanced", notes: ["Refined", "Noticeable", "Versatile"], helper: "A clear presence with polished restraint.", keywords: ["moderate", "balanced", "5-7"] },
  { value: "strong", label: "Strong", notes: ["Confident", "Bold", "Memorable"], helper: "Designed to be noticed.", keywords: ["strong", "bold", "8 hours"] },
  { value: "long-lasting", label: "Long-lasting", notes: ["Trail", "Depth", "All evening"], helper: "Built for a longer scent story.", keywords: ["long", "lasting", "8 hours", "strong"] },
];

const STEPS = [
  { key: "mood", title: "Choose the mood of your scent.", short: "Mood", options: MOOD_OPTIONS },
  { key: "occasion", title: "Where will this perfume be worn?", short: "Occasion", options: OCCASION_OPTIONS },
  { key: "family", title: "Pick the scent family that feels right.", short: "Family", options: FAMILY_OPTIONS },
  { key: "intensity", title: "How present should it feel?", short: "Intensity", options: INTENSITY_OPTIONS },
];

const EMPTY_SELECTIONS = { mood: "", occasion: "", family: "", intensity: "" };

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function optionByValue(key, value) {
  return STEPS.find((step) => step.key === key)?.options.find((option) => option.value === value);
}

function selectedCount(selections) {
  return Object.values(selections).filter(Boolean).length;
}

function selectedOptions(selections) {
  return STEPS.map((step) => ({ ...step, selected: optionByValue(step.key, selections[step.key]) }));
}

function productTokens(product) {
  return [
    product.name,
    product.description,
    product.family,
    product.gender,
    product.intensity,
    product.concentration,
    product.longevity,
    ...(Array.isArray(product.notes) ? product.notes : []),
    ...(Array.isArray(product.tags) ? product.tags : []),
    ...(Array.isArray(product.occasionTags) ? product.occasionTags : []),
  ].map(normalize).filter(Boolean);
}

function keywordScore(tokens, keywords, weight) {
  return (keywords || []).reduce((sum, keyword) => {
    const needle = normalize(keyword);
    return sum + (tokens.some((token) => token.includes(needle)) ? weight : 0);
  }, 0);
}

function scorePerfume(product, selections) {
  const tokens = productTokens(product);
  const reasons = [];
  let score = Number(product.rating || 0);

  const mood = optionByValue("mood", selections.mood);
  const occasion = optionByValue("occasion", selections.occasion);
  const family = optionByValue("family", selections.family);
  const intensity = optionByValue("intensity", selections.intensity);

  const moodScore = keywordScore(tokens, mood?.keywords, 3);
  if (moodScore) {
    score += moodScore;
    reasons.push(`${mood.label} mood`);
  }

  const occasionScore = keywordScore(tokens, occasion?.keywords, 2);
  if (occasionScore) {
    score += occasionScore;
    reasons.push(`${occasion.label} occasion`);
  }

  if (family) {
    const familyScore = normalize(product.family).includes(family.value) || tokens.some((token) => token.includes(family.value)) ? 5 : 0;
    if (familyScore) {
      score += familyScore;
      reasons.push(`${family.label} family`);
    }
  }

  const intensityScore = keywordScore(tokens, intensity?.keywords, 2);
  if (intensityScore) {
    score += intensityScore;
    reasons.push(`${intensity.label} intensity`);
  }

  return {
    product,
    score,
    reasons: reasons.length ? reasons.slice(0, 3) : ["Closest perfume profile"],
  };
}

function matchLabel(index) {
  if (index === 0) return "Best match";
  if (index < 3) return "Strong match";
  return "Also consider";
}

function ScentProfileCard({ selections, scoredPerfumes, onBrowse, onViewProduct, onContinue }) {
  const count = selectedCount(selections);
  const selected = selectedOptions(selections);
  const bestMatch = scoredPerfumes[0];
  const notes = bestMatch?.product?.notes?.slice(0, 4) || selected.flatMap((item) => item.selected?.notes || []).slice(0, 4);
  const profileTitle = selected.map((item) => item.selected?.label).filter(Boolean).join(" · ");

  return (
    <aside className="tuti-finder__profile" aria-label="Scent profile">
      <span className="tuti-finder__eyebrow">Live scent profile</span>
      {count === 0 ? (
        <>
          <h2>Your scent profile will appear here.</h2>
          <p>Choose your answers and the concierge will build a perfume-only edit as you go.</p>
        </>
      ) : count === 1 ? (
        <>
          <h2>{profileTitle}</h2>
          <p>Choose one more answer to unlock your profile.</p>
        </>
      ) : (
        <>
          <h2>{profileTitle}</h2>
          <p>
            This profile leans toward {selected.slice(0, 2).map((item) => item.selected?.label).filter(Boolean).join(" and ").toLowerCase()} perfumes with a polished boutique finish.
          </p>
        </>
      )}

      <div className="tuti-finder__profile-slots">
        {selected.map((item) => (
          <span className={item.selected ? "is-filled" : ""} key={item.key}>
            <small>{item.short}</small>
            {item.selected?.label || item.short}
          </span>
        ))}
      </div>

      {count >= 2 ? (
        <>
          <div className="tuti-finder__confidence">
            <strong>{count === STEPS.length ? "Final edit ready" : "Profile unlocked"}</strong>
            <span>{Math.min(100, 48 + count * 13)}% match confidence</span>
          </div>
          <div className="tuti-finder__note-strip">
            {notes.map((note) => <span key={note}>{note}</span>)}
          </div>
          <div className="tuti-finder__profile-reasons">
            {(bestMatch?.reasons || []).map((reason) => (
              <span key={reason}><CheckCircle2 size={14} aria-hidden="true" />{reason}</span>
            ))}
          </div>
        </>
      ) : null}

      <div className="tuti-finder__profile-actions">
        {count === STEPS.length && bestMatch ? (
          <TutiButton onClick={() => onViewProduct?.(bestMatch.product.id)} icon={<ArrowRight size={16} />} iconPosition="right">
            View matched perfumes
          </TutiButton>
        ) : (
          <TutiButton onClick={onContinue} icon={<ArrowRight size={16} />} iconPosition="right">
            Continue refining
          </TutiButton>
        )}
        <TutiButton variant="ghost" onClick={onBrowse}>Browse all perfumes</TutiButton>
      </div>
    </aside>
  );
}

function ScentEditStrip({ selections }) {
  return (
    <section className="tuti-finder__edit-strip" aria-label="Your scent edit">
      <div>
        <span className="tuti-finder__eyebrow">Your scent edit</span>
        <h2>A guided profile, refined one answer at a time.</h2>
      </div>
      <div className="tuti-finder__edit-answers">
        {selectedOptions(selections).map((item) => (
          <span className={item.selected ? "is-filled" : ""} key={item.key}>
            <small>{item.short}</small>
            {item.selected?.label || "Choose"}
          </span>
        ))}
      </div>
    </section>
  );
}

function MatchCard({ match, index, getShop, onViewProduct }) {
  const { product, reasons } = match;
  const shop = resolveShop(product, null, getShop);
  const notes = Array.isArray(product.notes) ? product.notes.slice(0, 3).join(" · ") : "";
  const image = product.imageUrl || product.images?.[0];

  return (
    <article className="tuti-finder__match-card">
      <div className="tuti-finder__match-media">
        {image ? <img src={image} alt="" /> : <strong aria-hidden="true">{product.name?.slice(0, 1) || "T"}</strong>}
        <span>{matchLabel(index)}</span>
      </div>
      <div className="tuti-finder__match-body">
        <div className="tuti-finder__match-top">
          <TutiBadge tone={index === 0 ? "champagne" : "neutral"}>{product.family || "Perfume"}</TutiBadge>
          <span>{formatCurrency(product.price)}</span>
        </div>
        <h3>{product.name}</h3>
        <p>{notes || product.description || "A boutique-stocked perfume selected for your scent edit."}</p>
        <div className="tuti-finder__match-reason">
          {(reasons || []).slice(0, 2).map((reason) => <span key={reason}>{reason}</span>)}
        </div>
        <div className="tuti-finder__match-footer">
          <small>{shop?.name || product.shopName || "Tuti boutique"}</small>
          <TutiButton variant="ghost" size="sm" onClick={() => onViewProduct?.(product.id)}>View perfume</TutiButton>
        </div>
      </div>
    </article>
  );
}

function ClosingSection({ onBrowse, onNavigate }) {
  return (
    <section className="tuti-finder__closing" aria-label="More scent help">
      <div>
        <span className="tuti-finder__eyebrow">Still deciding?</span>
        <h2>Keep exploring with Tuti.</h2>
      </div>
      <div className="tuti-finder__closing-grid">
        <button type="button" onClick={onBrowse}>
          <strong>Browse all perfumes</strong>
          <span>See the full boutique perfume catalogue.</span>
        </button>
        <button type="button" onClick={() => onNavigate?.("/build-a-box")}>
          <strong>Build a Gift separately</strong>
          <span>Customize a boutique-prepared gift in its own flow.</span>
        </button>
        <button type="button" onClick={() => onNavigate?.("/support")}>
          <strong>Ask for gifting help</strong>
          <span>Get support before choosing a perfume gift.</span>
        </button>
      </div>
    </section>
  );
}

export function FragranceFinderPage({
  products = [],
  getShop,
  onNavigate,
  onViewProduct,
  onShopWithPreferences,
}) {
  const [started, setStarted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [selections, setSelections] = useState(EMPTY_SELECTIONS);

  const perfumes = useMemo(
    () => products.filter((product) => normalize(product.category) === "perfume" && product.status !== "Draft" && product.stock !== 0),
    [products]
  );

  const scoredPerfumes = useMemo(() => (
    perfumes
      .map((product) => scorePerfume(product, selections))
      .sort((a, b) => b.score - a.score || Number(b.product.rating || 0) - Number(a.product.rating || 0))
  ), [perfumes, selections]);

  const currentStep = STEPS[stepIndex];
  const activeValue = selections[currentStep.key];
  const count = selectedCount(selections);
  const showResults = count === STEPS.length;
  const recommendations = scoredPerfumes.slice(0, 4);

  function browsePerfumes() {
    if (selections.family && onShopWithPreferences) {
      onShopWithPreferences(optionByValue("family", selections.family)?.label || "");
      return;
    }
    onNavigate?.("/shop?c=perfume");
  }

  function chooseOption(value) {
    setStarted(true);
    setSelections((current) => ({ ...current, [currentStep.key]: value }));
  }

  function goNext() {
    setStarted(true);
    if (stepIndex < STEPS.length - 1) setStepIndex((value) => value + 1);
  }

  function goBack() {
    if (stepIndex > 0) setStepIndex((value) => value - 1);
  }

  function continueRefining() {
    setStarted(true);
    if (activeValue && stepIndex < STEPS.length - 1) goNext();
  }

  function startEdit() {
    setStarted(true);
    setStepIndex(0);
  }

  return (
    <main className="tuti-finder">
      <section className="tuti-finder__hero" aria-labelledby="finder-title">
        <div className="tuti-finder__hero-copy">
          <TutiBadge tone="champagne">Find a Scent</TutiBadge>
          <h1 id="finder-title">Find your signature scent.</h1>
          <p>A guided perfume edit built around your mood, occasion, scent family, and intensity.</p>
          <div className="tuti-finder__hero-actions">
            <TutiButton size="lg" onClick={startEdit} icon={<Search size={18} />} iconPosition="right">
              Begin your scent edit
            </TutiButton>
            <TutiButton variant="ghost" size="lg" onClick={browsePerfumes}>Browse all perfumes</TutiButton>
          </div>
        </div>
        <div className="tuti-finder__moodboard" aria-hidden="true">
          {["Fresh", "Oud", "Musk", "Amber"].map((label, index) => (
            <div className={`tuti-finder__mood-card is-${index}`} key={label}>
              <span>{label}</span>
              <strong>{perfumes[index]?.family || label}</strong>
              <small>{perfumes[index]?.notes?.slice(0, 2).join(" · ") || "Boutique note"}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="tuti-finder__concierge" aria-label="Scent concierge">
        <div className="tuti-finder__concierge-top">
          <div>
            <span className="tuti-finder__eyebrow">Scent concierge</span>
            <h2>Answer one focused question at a time.</h2>
          </div>
          <div className="tuti-finder__progress" aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}>
            <span>Step {stepIndex + 1} of {STEPS.length}</span>
            <div aria-hidden="true">
              {STEPS.map((step, index) => (
                <button
                  className={`tuti-finder__dot${index === stepIndex ? " is-active" : ""}${selections[step.key] ? " is-complete" : ""}`}
                  key={step.key}
                  onClick={() => setStepIndex(index)}
                  type="button"
                  aria-label={`Go to ${step.short}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="tuti-finder__workspace">
          <div className="tuti-finder__selection-board">
            <div className="tuti-finder__question">
              <span className="tuti-finder__eyebrow">{currentStep.short}</span>
              <h2>{currentStep.title}</h2>
              {!started ? <p>Start with the answer that feels most natural. You can go back anytime.</p> : null}
            </div>
            <div className="tuti-finder__options">
              {currentStep.options.map((option) => (
                <button
                  className={`tuti-finder__option${activeValue === option.value ? " is-active" : ""}`}
                  key={option.value}
                  onClick={() => chooseOption(option.value)}
                  type="button"
                  aria-pressed={activeValue === option.value}
                >
                  <strong>{option.label}</strong>
                  <span>{option.notes?.join(" · ")}</span>
                  <em>{option.helper}</em>
                </button>
              ))}
            </div>
            <div className="tuti-finder__nav">
              <TutiButton variant="ghost" onClick={goBack} disabled={stepIndex === 0} icon={<ChevronLeft size={16} />}>
                Back
              </TutiButton>
              <TutiButton onClick={goNext} disabled={!activeValue || stepIndex === STEPS.length - 1} icon={<ArrowRight size={16} />} iconPosition="right">
                Next
              </TutiButton>
            </div>
          </div>

          <ScentProfileCard
            selections={selections}
            scoredPerfumes={scoredPerfumes}
            onBrowse={browsePerfumes}
            onContinue={continueRefining}
            onViewProduct={onViewProduct}
          />
        </div>
      </section>

      <ScentEditStrip selections={selections} />

      {!perfumes.length ? (
        <section className="tuti-finder__empty">
          <TutiEmptyState
            icon={<Sparkles size={22} />}
            title="No perfumes are live yet"
            description="The scent concierge is ready, but the perfume catalogue is currently empty."
            action={<TutiButton onClick={() => onNavigate?.("/shop")}>Browse shop</TutiButton>}
          />
        </section>
      ) : showResults ? (
        <section className="tuti-finder__results" aria-label="Matched perfumes">
          <div className="tuti-finder__results-head">
            <div>
              <span className="tuti-finder__eyebrow">Your matched perfumes</span>
              <h2>Perfumes curated for your scent profile.</h2>
              <p>Each recommendation is perfume-only and ranked from your four answers.</p>
            </div>
            <TutiButton variant="ghost" onClick={browsePerfumes}>Browse all perfumes</TutiButton>
          </div>
          <div className="tuti-finder__match-grid">
            {recommendations.map((match, index) => (
              <MatchCard
                key={match.product.id}
                match={match}
                index={index}
                getShop={getShop}
                onViewProduct={onViewProduct}
              />
            ))}
          </div>
        </section>
      ) : null}

      <ClosingSection onBrowse={browsePerfumes} onNavigate={onNavigate} />
    </main>
  );
}
