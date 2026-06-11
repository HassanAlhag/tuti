import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronRight, Gift, Sparkles } from "lucide-react";
import perfumeImage from "../../../assets/category-perfumes.jpg";
import cakeImage from "../../../assets/category-cakes.jpg";
import giftSetImage from "../../../assets/category-gift-sets.jpg";

/* ── Slide definitions ───────────────────────────────────────── */
const SLIDES = [
  {
    id: "gifting",
    eyebrow: "Luxury gifting boutique · UAE",
    headline: ["Scented moments.", "Sweet memories."],
    sub: "Perfumes, cakes, and beautifully crafted gift sets — curated for every occasion.",
    cta: "Shop gift sets",
    badge: "Gift sets",
    category: "gift_box",
    palette: {
      from:  "#1a0d07",
      to:    "#5c2b10",
      accent:"#d9a441",
      text:  "#fff",
      sub:   "rgba(255,255,255,0.72)",
      badge: "rgba(217,164,65,0.18)",
      badgeText: "#d9a441",
    },
    visual: "gift",
    image: giftSetImage,
  },
  {
    id: "perfumes",
    eyebrow: "Boutique fragrances",
    headline: ["Discover your", "perfect scent."],
    sub: "Oud, musk, floral, amber, and fresh fragrances from independent boutique shops across the UAE.",
    cta: "Shop perfumes",
    badge: "Perfumes",
    category: "perfume",
    palette: {
      from:  "#061a17",
      to:    "#0b4e47",
      accent:"#4ecdc4",
      text:  "#fff",
      sub:   "rgba(255,255,255,0.68)",
      badge: "rgba(15,111,97,0.22)",
      badgeText: "#4ecdc4",
    },
    visual: "perfume",
    image: perfumeImage,
  },
  {
    id: "cakes",
    eyebrow: "Artisan bakeries",
    headline: ["Cakes baked", "with love."],
    sub: "Signature cakes, Arabic sweets, and celebration desserts — made fresh for every occasion.",
    cta: "Shop cakes",
    badge: "Cakes & desserts",
    category: "cake",
    palette: {
      from:  "#1a0710",
      to:    "#7a2040",
      accent:"#f4b6c4",
      text:  "#fff",
      sub:   "rgba(255,255,255,0.68)",
      badge: "rgba(185,77,104,0.2)",
      badgeText: "#f4b6c4",
    },
    visual: "cake",
    image: cakeImage,
  },
];

/* ── Visual components ───────────────────────────────────────── */
function PerfumeVisual({ accent }) {
  return (
    <div className="slider-visual-wrap">
      <div className="sv-perfume" style={{ "--sa": accent }}>
        <div className="sv-p-cap" />
        <div className="sv-p-neck" />
        <div className="sv-p-body">
          <div className="sv-p-label">
            <Sparkles size={14} />
            <span>EDP</span>
          </div>
        </div>
        <div className="sv-p-base" />
      </div>
      <div className="sv-perfume sv-p-sm" style={{ "--sa": accent }}>
        <div className="sv-p-cap" />
        <div className="sv-p-neck" />
        <div className="sv-p-body" />
      </div>
      <div className="sv-orbit" style={{ "--sa": accent }} />
    </div>
  );
}

function CakeVisual({ accent }) {
  return (
    <div className="slider-visual-wrap">
      <div className="sv-cake" style={{ "--sa": accent }}>
        <div className="sv-c-candle" />
        <div className="sv-c-flame" style={{ "--sa": accent }} />
        <div className="sv-c-top" />
        <div className="sv-c-mid" />
        <div className="sv-c-base" />
        <div className="sv-c-plate" />
      </div>
      <div className="sv-sparkles" style={{ "--sa": accent }}>
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function GiftVisual({ accent }) {
  return (
    <div className="slider-visual-wrap">
      <div className="sv-gift" style={{ "--sa": accent }}>
        <div className="sv-g-lid">
          <div className="sv-g-bow-l" />
          <div className="sv-g-bow-r" />
        </div>
        <div className="sv-g-body">
          <div className="sv-g-ribbon-h" />
          <div className="sv-g-ribbon-v" />
          <Gift size={24} className="sv-g-icon" />
        </div>
      </div>
      <div className="sv-gift sv-g-sm" style={{ "--sa": accent }}>
        <div className="sv-g-lid" />
        <div className="sv-g-body" />
      </div>
    </div>
  );
}

function OccasionVisual({ accent }) {
  const icons = ["🎂", "💍", "✨", "🌸", "🎓", "🏢"];
  return (
    <div className="slider-visual-wrap">
      <div className="sv-occasions" style={{ "--sa": accent }}>
        {icons.map((e, i) => (
          <div key={i} className="sv-occ-chip" style={{ animationDelay: `${i * 0.15}s` }}>
            <span>{e}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideVisual({ slide }) {
  if (slide.image) {
    return (
      <div className="slider-photo-wrap">
        <img src={slide.image} alt="" aria-hidden="true" />
      </div>
    );
  }

  const { visual, palette } = slide;
  if (visual === "perfume")  return <PerfumeVisual  accent={palette.accent} />;
  if (visual === "cake")     return <CakeVisual     accent={palette.accent} />;
  if (visual === "gift")     return <GiftVisual     accent={palette.accent} />;
  if (visual === "occasion") return <OccasionVisual accent={palette.accent} />;
  return null;
}

/* ── Main slider component ───────────────────────────────────── */
export function HeroSlider({ onShopClick }) {
  const [current, setCurrent] = useState(0);
  const [prev,    setPrev]    = useState(null);
  const [dir,     setDir]     = useState("next");
  const [paused,  setPaused]  = useState(false);
  const [progress,setProgress] = useState(0);
  const timerRef  = useRef(null);
  const progRef   = useRef(null);
  const DURATION  = 5000;

  const go = useCallback((idx, direction = "next") => {
    setDir(direction);
    setPrev(current);
    setCurrent(idx);
    setProgress(0);
  }, [current]);

  const next = useCallback(() => go((current + 1) % SLIDES.length, "next"), [current, go]);
  const prev_ = useCallback(() => go((current - 1 + SLIDES.length) % SLIDES.length, "prev"), [current, go]);

  // Auto-advance
  useEffect(() => {
    if (paused) return;
    timerRef.current = setTimeout(next, DURATION);
    return () => clearTimeout(timerRef.current);
  }, [current, paused, next]);

  // Progress bar
  useEffect(() => {
    if (paused) return;
    setProgress(0);
    const step = 50;
    progRef.current = setInterval(() => {
      setProgress((p) => Math.min(100, p + (step / DURATION) * 100));
    }, step);
    return () => clearInterval(progRef.current);
  }, [current, paused]);

  // Swipe support
  const touchStart = useRef(null);
  function onTouchStart(e) { touchStart.current = e.touches[0].clientX; }
  function onTouchEnd(e) {
    if (!touchStart.current) return;
    const delta = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 50) delta > 0 ? next() : prev_();
    touchStart.current = null;
  }

  const slide = SLIDES[current];
  const p     = slide.palette;

  return (
    <section
      className="hero-slider"
      style={{ "--hs-from": p.from, "--hs-to": p.to, "--hs-accent": p.accent }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      aria-label="Featured collections"
    >
      {/* ── Background gradient (animated on change) ─────────── */}
      <div className="hs-bg" />

      {/* ── Decorative ambient orbs ──────────────────────────── */}
      <div className="hs-orb hs-orb-1" />
      <div className="hs-orb hs-orb-2" />

      <div className="hs-inner">
        {/* ── Content ────────────────────────────────────────── */}
        <div className={`hs-content hs-anim-${dir}`} key={`content-${current}`}>
          <span
            className="hs-badge"
            style={{ background: p.badge, color: p.badgeText }}
          >
            {slide.badge}
          </span>

          <h1 className="hs-headline" style={{ color: p.text }}>
            {slide.headline[0]}
            <br />
            <span className="hs-headline-accent" style={{ color: p.accent }}>
              {slide.headline[1]}
            </span>
          </h1>

          <p className="hs-sub" style={{ color: p.sub }}>{slide.sub}</p>

          <div className="hs-actions">
            <button
              className="hs-cta-btn"
              style={{ background: p.accent, color: "#1a1209" }}
              onClick={() => onShopClick(slide.category)}
              type="button"
            >
              {slide.cta}
              <ChevronRight size={17} />
            </button>
            <button
              className="hs-ghost-btn"
              style={{ color: "rgba(255,255,255,0.75)", borderColor: "rgba(255,255,255,0.2)" }}
              onClick={() => onShopClick()}
              type="button"
            >
              Browse all
            </button>
          </div>

        </div>

        {/* ── Visual ─────────────────────────────────────────── */}
        <div className={`hs-visual-col hs-anim-${dir}`} key={`visual-${current}`}>
          <SlideVisual slide={slide} />
        </div>
      </div>

      {/* ── Navigation arrows ─────────────────────────────────── */}
      <button className="hs-arrow hs-arrow-prev" onClick={prev_} aria-label="Previous slide" type="button">
        <ArrowLeft size={20} />
      </button>
      <button className="hs-arrow hs-arrow-next" onClick={next} aria-label="Next slide" type="button">
        <ArrowRight size={20} />
      </button>

      {/* ── Dot nav + progress ────────────────────────────────── */}
      <div className="hs-dots">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            className={i === current ? "hs-dot active" : "hs-dot"}
            onClick={() => go(i, i > current ? "next" : "prev")}
            aria-label={`Go to slide ${i + 1}`}
            type="button"
          >
            {i === current && (
              <span
                className="hs-dot-progress"
                style={{ width: `${progress}%`, background: p.accent }}
              />
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
