import { useRef, useState } from "react";
import { ArrowRight, Gift, PackageCheck, ShieldCheck, Sparkles, Star, UtensilsCrossed, Wand2, Zap } from "lucide-react";
import { useSeoMeta } from "@tuti/shared/hooks/useSeoMeta.js";
import "../gifting.css";

const OCCASIONS = [
  { id: "birthday",    label: "Birthday" },
  { id: "graduation",  label: "Graduation" },
  { id: "anniversary", label: "Anniversary" },
  { id: "thank-you",   label: "Thank You" },
  { id: "corporate",   label: "Corporate" },
  { id: "new-baby",    label: "New Baby" },
  { id: "eid",         label: "Eid / Ramadan" },
  { id: "apology",     label: "Apology" },
];

const MOODS = [
  { id: "sweet",   Icon: Sparkles,     label: "Sweet celebration", desc: "Cakes, desserts, and celebratory gifts" },
  { id: "premium", Icon: Star,         label: "Premium personal",  desc: "Refined, lasting gifts — perfumes and luxury boxes" },
  { id: "ready",   Icon: Zap,          label: "Ready surprise",    desc: "Curated gift boxes, ready to present" },
  { id: "custom",  Icon: Wand2,        label: "Custom touch",      desc: "Personalized message and custom presentation" },
];

const MOOD_INSIGHTS = {
  sweet:   "Best for birthdays, family gatherings, and shared moments of joy.",
  premium: "Best for elegant gifts that feel thoughtful, lasting, and personal.",
  ready:   "Best when you want a polished, occasion-ready gift with no fuss.",
  custom:  "Best when a message, cake writing, or wrapping makes all the difference.",
};

/* Best match per mood — drives the result panel and card featuring */
const BEST_MATCH = {
  sweet: {
    cardId:         "cake",
    Icon:           UtensilsCrossed,
    accent:         "#db6b7a",
    heading:        "Start with Cakes & Desserts",
    reason:         "Best for shared celebrations, family moments, and joyful surprises. Each cake boutique prepares and delivers its own gifts.",
    primaryLabel:   "Shop cakes & desserts",
    primaryRoute:   "/shop/cake",
    secondaryLabel: "Build a Gift",
    secondaryRoute: "/build-a-box",
  },
  premium: {
    cardId:         "perfume",
    Icon:           Sparkles,
    accent:         "#5b7cf4",
    heading:        "Start with Perfumes",
    reason:         "A refined, lasting choice — perfumes from verified boutiques carry a personal signature that endures.",
    primaryLabel:   "Shop perfumes",
    primaryRoute:   "/shop/perfume",
    secondaryLabel: "Build a Gift",
    secondaryRoute: "/build-a-box",
  },
  ready: {
    cardId:         "gift_box",
    Icon:           Gift,
    accent:         "#2da58e",
    heading:        "Start with Ready Gift Boxes",
    reason:         "Polished, occasion-specific, and ready to present. Each boutique curates and prepares its own gift boxes.",
    primaryLabel:   "Shop gift boxes",
    primaryRoute:   "/shop/gift_box",
    secondaryLabel: "Build a Gift",
    secondaryRoute: "/build-a-box",
  },
  custom: {
    cardId:         "build",
    Icon:           PackageCheck,
    accent:         "#b88a2e",
    heading:        "Build your gift from one boutique",
    reason:         "Choose products from one boutique, add a personal message, and save a customized gift to cart.",
    primaryLabel:   "Build a Gift",
    primaryRoute:   "/build-a-box",
    secondaryLabel: "Browse all gifts",
    secondaryRoute: "/shop",
  },
};

/* Secondary rank labels for non-featured cards when a mood is selected */
const CARD_RANK_LABELS = {
  perfume: "Premium option",
  cake:    "Sweet option",
  gift_box: "Ready option",
  build:   "Custom option",
};

const CARDS = [
  {
    id: "perfume",
    Icon: Sparkles,
    eyebrow: "Perfumes",
    title: "Signature scents",
    bestFor: "Refined, lasting gifts with a personal signature",
    body: "Perfumes from verified boutiques across the UAE — Arabic oud blends, fresh florals, and exclusive signatures.",
    ctaLabel: "Shop perfumes",
    route: "/shop/perfume",
    accent: "#5b7cf4",
  },
  {
    id: "cake",
    Icon: UtensilsCrossed,
    eyebrow: "Cakes & Desserts",
    title: "Celebration cakes",
    bestFor: "Sweet, joyful moments and shared celebrations",
    body: "Layered cakes, dessert boxes, and sweet treats prepared by cake boutiques — ready for collection or delivery.",
    ctaLabel: "Shop cakes",
    route: "/shop/cake",
    accent: "#db6b7a",
  },
  {
    id: "gift_box",
    Icon: Gift,
    eyebrow: "Ready Gift Boxes",
    title: "Curated boxes",
    bestFor: "Polished, occasion-ready surprises with no fuss",
    body: "Ready-made gift boxes prepared by boutiques — elegant, occasion-specific, and delivered as presented.",
    ctaLabel: "Shop gift boxes",
    route: "/shop/gift_box",
    accent: "#2da58e",
  },
  {
    id: "build",
    Icon: PackageCheck,
    eyebrow: "Build a Gift",
    title: "Your gift, your way",
    bestFor: "When the message and presentation matter most",
    body: "Choose products from one boutique, add a personal message, and save a customized gift to cart.",
    ctaLabel: "Build a Gift",
    route: "/build-a-box",
    accent: "#b88a2e",
    isBuild: true,
  },
];

const OCCASION_GUIDES = {
  birthday: {
    featuredAdvice: "Birthdays call for warmth and personality.",
    featuredSub:    "A signature perfume makes a refined, lasting impression. A celebration cake signals effort and care. Ready gift boxes are a confident, polished choice when you want something beautifully presented.",
    worksWell:      ["Celebration cakes + personal cake writing", "Signature or fresh floral perfumes", "Ready gift boxes from boutiques"],
    personalTouch:  "Add a message through Build a Gift when you want the gift to feel handpicked — not just purchased.",
    remember:       "Perfume, cakes, and gift boxes are separate boutique journeys — choose one per gift.",
  },
  graduation: {
    featuredAdvice: "Graduation gifts should feel milestone-worthy.",
    featuredSub:    "Premium perfumes mark the moment with something lasting. Ready gift boxes are elegant and occasion-ready without the guesswork. Dessert boxes add a celebratory, joyful touch.",
    worksWell:      ["Premium or fresh perfumes for a lasting milestone gift", "Curated ready gift boxes", "Dessert boxes with a celebratory feel"],
    personalTouch:  "A message through Build a Gift turns a thoughtful product into a keepsake moment.",
    remember:       "Perfumes and cakes are separate boutique journeys — they are not combined into one gift.",
  },
  anniversary: {
    featuredAdvice: "Anniversary gifts reward intention.",
    featuredSub:    "A premium perfume — especially a signature or oud blend — communicates real thought. Ready gift boxes from boutiques are elegant without requiring any customization. Build a Gift adds a personal message.",
    worksWell:      ["Signature, oriental, or oud perfumes", "Premium ready gift boxes", "Floral perfumes for a romantic touch"],
    personalTouch:  "A custom presentation and handwritten-style message through Build a Gift elevates the moment significantly.",
    remember:       "Build a Gift works with one boutique at a time — each boutique prepares its own packaging.",
  },
  "thank-you": {
    featuredAdvice: "A thank-you gift should feel considered, not extravagant.",
    featuredSub:    "A boutique perfume or a sweet dessert box communicates care and thought. Ready gift boxes keep the gesture polished without over-complicating it.",
    worksWell:      ["Light or floral perfumes", "Dessert boxes and sweet treats", "Ready gift boxes for a polished touch"],
    personalTouch:  "Adding a message through Build a Gift transforms a good gift into a memorable one.",
    remember:       "Match the scale of the gift to the relationship. A ready gift box is often exactly right.",
  },
  corporate: {
    featuredAdvice: "Corporate gifts should be elegant, inclusive, and presentation-led.",
    featuredSub:    "Premium perfumes and ready gift boxes are safe, well-received choices. Avoid anything too personal — a refined presentation matters more than niche selection.",
    worksWell:      ["Neutral or refined perfumes", "Ready gift boxes with elegant packaging", "Build a Gift for consistent custom messaging"],
    personalTouch:  "Build a Gift works well for personalized presentation across multiple recipients from one boutique.",
    remember:       "Each boutique prepares its own gifts. Keep the tone professional and the presentation clean.",
  },
  "new-baby": {
    featuredAdvice: "A new baby calls for warmth above all else.",
    featuredSub:    "Dessert boxes for parents signal celebration and care. Soft, light perfumes are a thoughtful personal gift. Ready gift boxes keep the gesture easy and polished.",
    worksWell:      ["Sweet dessert boxes for new parents", "Soft, light floral perfumes", "Ready occasion gift boxes"],
    personalTouch:  "A message through Build a Gift makes a simple gift feel deeply personal for a new family.",
    remember:       "Focus on the parents as much as the occasion. Dessert boxes and floral perfumes both work well.",
  },
  eid: {
    featuredAdvice: "Eid and Ramadan gifts carry cultural weight.",
    featuredSub:    "Oud and Arabic perfumes are a classic, deeply appreciated choice. Dessert boxes and sweets suit the generosity of the season. Gift boxes curated for the occasion present beautifully.",
    worksWell:      ["Oud, oriental, or Arabic perfumes", "Dessert boxes and traditional sweets", "Occasion-ready gift boxes"],
    personalTouch:  "An Eid message through Build a Gift adds real sincerity to the gesture.",
    remember:       "Perfume is a traditional Eid gift with cultural meaning. Cakes and desserts are equally appreciated.",
  },
  apology: {
    featuredAdvice: "A sincere apology gift should be warm, not excessive.",
    featuredSub:    "A soft floral perfume or a thoughtful dessert box communicates care. Keep the presentation simple — the gesture matters more than the price.",
    worksWell:      ["Soft floral or fresh perfumes", "Dessert boxes and sweet treats", "Ready gift boxes for a sincere touch"],
    personalTouch:  "A genuine message through Build a Gift can carry more weight than the gift itself.",
    remember:       "Choose warmth over extravagance. A sincere and simple presentation matters most.",
  },
};

const TRUST = [
  { Icon: ShieldCheck,  label: "Verified boutiques",         desc: "Every seller is verified before listing on Tuti." },
  { Icon: PackageCheck, label: "Prepared by each boutique",  desc: "Each boutique prepares its own gifts and packaging." },
  { Icon: Wand2,        label: "Build a Gift saves to cart", desc: "Personalize with a message, wrapping, or cake writing from one boutique." },
  { Icon: Gift,         label: "VAT shown before checkout",  desc: "No hidden charges — VAT is displayed before you pay." },
];

export function GiftingPage({ onNavigate }) {
  useSeoMeta({
    title: "Gift Advisor — Find the Right Gift for the Moment | Tuti",
    description: "Discover perfumes, cakes, desserts, and ready gift boxes from verified boutiques across the UAE. Interactive gift advisor by occasion and mood.",
    canonical: "https://tuti.ae/gifting",
  });

  const advisorRef = useRef(null);
  const [occasion, setOccasion] = useState("birthday");
  const [mood, setMood] = useState(null);

  const occasionLabel = OCCASIONS.find((o) => o.id === occasion)?.label ?? "Birthday";
  const guide         = OCCASION_GUIDES[occasion] ?? OCCASION_GUIDES.birthday;
  const bestMatch     = mood ? BEST_MATCH[mood] : null;

  return (
    <main className="page-shell tuti-gifting">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="tuti-gifting__hero">
        <div className="tuti-gifting__hero-inner">
          <span className="tuti-gifting__hero-eyebrow">
            <Sparkles size={11} aria-hidden="true" />
            Gift Advisor
          </span>
          <h1>Find the right gift<br />for the moment.</h1>
          <p>
            Tell us the occasion and how you want it to feel. We&rsquo;ll point you
            to the right gift style — perfumes, cakes, gift boxes, or a customized gift.
          </p>
          <div className="tuti-gifting__hero-actions">
            <button
              type="button"
              className="tuti-gifting__hero-cta tuti-gifting__hero-cta--primary"
              onClick={() =>
                advisorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              Start with an occasion
              <ArrowRight size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="tuti-gifting__hero-cta tuti-gifting__hero-cta--secondary"
              onClick={() => onNavigate("/build-a-box")}
            >
              <PackageCheck size={15} aria-hidden="true" />
              Build a Gift
            </button>
          </div>
        </div>
      </section>

      {/* ── CONTENT ───────────────────────────────────────────────── */}
      <div className="tuti-gifting__content">

        {/* ── ADVISOR PANEL ───────────────────────────────────────── */}
        <section ref={advisorRef} aria-label="Gift Advisor">
          <div className="tuti-gifting__advisor-intro">
            <h2>Choose an occasion, then pick a mood.</h2>
            <p>Two steps — your recommendation appears below.</p>
          </div>
          <div className="tuti-gifting__advisor">

            {/* Step 1 — Occasion */}
            <div className="tuti-gifting__step">
              <div className="tuti-gifting__step-header">
                <span className="tuti-gifting__step-num" aria-hidden="true">1</span>
                <span className="tuti-gifting__step-label">What&rsquo;s the occasion?</span>
              </div>
              <div className="tuti-gifting__chips" role="group" aria-label="Select an occasion">
                {OCCASIONS.map((occ) => (
                  <button
                    key={occ.id}
                    type="button"
                    aria-pressed={occasion === occ.id}
                    className={`tuti-gifting__chip${occasion === occ.id ? " tuti-gifting__chip--active" : ""}`}
                    onClick={() => setOccasion(occ.id)}
                  >
                    {occ.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2 — Mood */}
            <div className="tuti-gifting__step">
              <div className="tuti-gifting__step-header">
                <span className="tuti-gifting__step-num" aria-hidden="true">2</span>
                <span className="tuti-gifting__step-label">How should it feel?</span>
              </div>
              <div className="tuti-gifting__moods" role="group" aria-label="Select a gift mood">
                {MOODS.map(({ id, Icon, label, desc }) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={mood === id}
                    className={`tuti-gifting__mood-card${mood === id ? " tuti-gifting__mood-card--active" : ""}`}
                    onClick={() => setMood(id === mood ? null : id)}
                  >
                    <span className="tuti-gifting__mood-icon" aria-hidden="true">
                      <Icon size={15} />
                    </span>
                    <span className="tuti-gifting__mood-label">{label}</span>
                    <span className="tuti-gifting__mood-desc">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Task C — Mood insight strip */}
            {mood ? (
              <div
                className="tuti-gifting__mood-insight"
                aria-live="polite"
                key={mood}
              >
                <span className="tuti-gifting__mood-insight-dot" aria-hidden="true">✦</span>
                <p className="tuti-gifting__mood-insight-text">{MOOD_INSIGHTS[mood]}</p>
              </div>
            ) : null}
          </div>
        </section>

        {/* ── Task A — BEST MATCH RESULT PANEL ────────────────────── */}
        {bestMatch ? (
          <section
            aria-label="Your best match recommendation"
            aria-live="polite"
            key={`result-${mood}-${occasion}`}
          >
            <div className="tuti-gifting__result">
              <div className="tuti-gifting__result-meta">
                <span className="tuti-gifting__result-tag">
                  ✦ Your best match
                </span>
                <span className="tuti-gifting__result-context">
                  <span className="tuti-gifting__result-context-sep">·</span>
                  {occasionLabel}
                  <span className="tuti-gifting__result-context-sep">+</span>
                  {MOODS.find((m) => m.id === mood)?.label}
                </span>
              </div>
              <div className="tuti-gifting__result-body">
                <div
                  className="tuti-gifting__result-icon"
                  aria-hidden="true"
                  style={{ borderColor: `${bestMatch.accent}55`, background: `${bestMatch.accent}22` }}
                >
                  <bestMatch.Icon size={22} />
                </div>
                <div className="tuti-gifting__result-text">
                  <h2 className="tuti-gifting__result-heading">{bestMatch.heading}</h2>
                  <p className="tuti-gifting__result-reason">{bestMatch.reason}</p>
                </div>
              </div>
              <div className="tuti-gifting__result-actions">
                <button
                  type="button"
                  className="tuti-gifting__result-cta tuti-gifting__result-cta--primary"
                  onClick={() => onNavigate(bestMatch.primaryRoute)}
                >
                  {bestMatch.primaryLabel}
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="tuti-gifting__result-cta tuti-gifting__result-cta--ghost"
                  onClick={() => onNavigate(bestMatch.secondaryRoute)}
                >
                  {bestMatch.secondaryLabel}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {/* ── Tasks B + D — RANKED RECOMMENDATION CARDS ───────────── */}
        <section aria-label={`Gift recommendations for ${occasionLabel}`}>
          <div className="tuti-gifting__cards-heading">
            <h2>{mood ? "All gift styles" : "Choose a gift style"}</h2>
            {mood ? (
              <span className="tuti-gifting__cards-heading-sub">
                — or explore all paths for {occasionLabel}
              </span>
            ) : null}
          </div>
          <div className="tuti-gifting__cards">
            {CARDS.map(({ id, Icon, eyebrow, title, bestFor, body, ctaLabel, route, accent, isBuild }) => {
              const isFeatured = Boolean(mood && bestMatch?.cardId === id);
              const isSecondary = Boolean(mood && !isFeatured);
              return (
                <article
                  key={id}
                  style={{ "--ga": accent }}
                  className={[
                    "tuti-gifting__card",
                    isBuild     ? "tuti-gifting__card--build"    : "",
                    isFeatured  ? "tuti-gifting__card--featured"  : "",
                    isSecondary ? "tuti-gifting__card--secondary" : "",
                  ].filter(Boolean).join(" ")}
                  aria-label={isFeatured ? `${title} — Best match for your selection` : title}
                >
                  {/* Colored wash — Task D */}
                  <div
                    className="tuti-gifting__card-wash"
                    aria-hidden="true"
                    style={{ background: `linear-gradient(160deg, ${accent}18 0%, transparent 65%)` }}
                  />

                  {/* Rank row — Task B */}
                  <div className="tuti-gifting__card-top">
                    {isFeatured ? (
                      <span className="tuti-gifting__card-badge">✦ Best match</span>
                    ) : mood ? (
                      <span className="tuti-gifting__card-rank">{CARD_RANK_LABELS[id]}</span>
                    ) : null}
                  </div>

                  <div className="tuti-gifting__card-icon" aria-hidden="true">
                    <Icon size={18} />
                  </div>
                  <span className="tuti-gifting__card-eyebrow">{eyebrow}</span>
                  <h3 className="tuti-gifting__card-title">{title}</h3>
                  <p className="tuti-gifting__card-best">
                    <strong>Best for:</strong> {bestFor}
                  </p>
                  <p className="tuti-gifting__card-body">{body}</p>
                  <button
                    type="button"
                    className="tuti-gifting__cta"
                    onClick={() => onNavigate(route)}
                  >
                    {ctaLabel}
                    <ArrowRight size={13} aria-hidden="true" />
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── Task E — EDITORIAL GUIDE ─────────────────────────────── */}
        <section aria-label={`Gift advice for ${occasionLabel}`}>
          <div className="tuti-gifting__editorial">
            <div className="tuti-gifting__editorial-advice">
              <span className="tuti-gifting__editorial-label">
                Gift advice for {occasionLabel}
              </span>
              <p className="tuti-gifting__editorial-advice-heading">
                {guide.featuredAdvice}
              </p>
              <p className="tuti-gifting__editorial-advice-body">
                {guide.featuredSub}
              </p>
            </div>
            <div className="tuti-gifting__editorial-chips">
              <div className="tuti-gifting__editorial-chip">
                <span className="tuti-gifting__editorial-chip-label">Works well</span>
                <ul
                  className="tuti-gifting__editorial-chip-items"
                  aria-label={`What works for ${occasionLabel}`}
                >
                  {guide.worksWell.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="tuti-gifting__editorial-chip">
                <span className="tuti-gifting__editorial-chip-label">Personal touch</span>
                <p className="tuti-gifting__editorial-chip-text">{guide.personalTouch}</p>
              </div>
              <div className="tuti-gifting__editorial-chip">
                <span className="tuti-gifting__editorial-chip-label">Remember</span>
                <p className="tuti-gifting__editorial-chip-text">{guide.remember}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── TRUST STRIP ─────────────────────────────────────────── */}
        <section className="tuti-gifting__trust" aria-label="How Tuti gifting works">
          {TRUST.map(({ Icon, label, desc }) => (
            <div key={label} className="tuti-gifting__trust-item">
              <div className="tuti-gifting__trust-icon" aria-hidden="true">
                <Icon size={14} />
              </div>
              <span className="tuti-gifting__trust-label">{label}</span>
              <p className="tuti-gifting__trust-desc">{desc}</p>
            </div>
          ))}
        </section>

      </div>
    </main>
  );
}
