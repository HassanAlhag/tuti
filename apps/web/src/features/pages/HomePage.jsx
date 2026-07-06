import { useMemo } from "react";
import {
  ArrowRight,
  CakeSlice,
  Gift,
  Lock,
  Package,
  ShieldCheck,
  Sparkles,
  SprayCan,
  Store,
  Truck,
  Wand2,
} from "lucide-react";
import {
  TutiBadge,
  TutiButton,
  TutiCard,
  TutiMediaStage,
  TutiSection,
} from "../../ui/customer/primitives/index.js";
import {
  TutiProductRail,
  TutiTrustStrip,
} from "../../ui/customer/commerce/index.js";
import cakeCategoryImage from "../../assets/category-cakes.jpg";
import giftSetCategoryImage from "../../assets/category-gift-sets.jpg";
import perfumeCategoryImage from "../../assets/category-perfumes.jpg";
import perfumeHeroImage from "../../assets/perfume-hero.png";
import "../homepage/homepage.css";

const SHORTCUTS = [
  { label: "Perfumes", category: "perfume", icon: SprayCan, tone: "cyan" },
  { label: "Cakes", category: "cake", icon: CakeSlice, tone: "champagne" },
  { label: "Gift Boxes", category: "gift_box", icon: Package, tone: "champagne" },
  { label: "Same Day", category: "all", icon: Truck, tone: "neutral" },
  { label: "AI Finder", action: "finder", icon: Wand2, tone: "cyan" },
  { label: "Boutiques", action: "shops", icon: Store, tone: "neutral" },
];

const TRUST_ITEMS = [
  {
    icon: <ShieldCheck size={18} />,
    title: "Verified boutiques",
    description: "Seller quality checks before products go live.",
  },
  {
    icon: <Truck size={18} />,
    title: "Same-day UAE delivery",
    description: "Local delivery windows for urgent gifting moments.",
  },
  {
    icon: <Lock size={18} />,
    title: "COD-ready launch",
    description: "Clear cash-on-delivery checkout and confirmation.",
  },
  {
    icon: <Gift size={18} />,
    title: "Curated pairings",
    description: "Perfume, cake and gift box discovery in one place.",
  },
];

const OCCASION_CARDS = [
  {
    title: "Birthday gifts",
    text: "Cakes, fragrance and polished boxes for celebrations.",
    category: "cake",
    badge: "Celebration",
  },
  {
    title: "Evening fragrance",
    text: "Oud, amber and richer perfume edits for memorable nights.",
    category: "perfume",
    badge: "Perfume edit",
  },
  {
    title: "Ready gift sets",
    text: "Premium boxes with room for messages and thoughtful add-ons.",
    category: "gift_box",
    badge: "Gift-ready",
  },
];

function productCategory(product) {
  const category = String(product?.category || "").toLowerCase();
  if (category === "bundle") return "gift_box";
  if (category === "dessert") return "cake";
  return category || "perfume";
}

function firstLiveProducts(products = [], limit = 10) {
  return products
    .filter((product) => !product.status || product.status === "Live")
    .slice(0, limit);
}

function pickProducts(products = [], category, limit = 10) {
  return firstLiveProducts(products, 40)
    .filter((product) => {
      const type = productCategory(product);
      if (category === "gift_box") return type === "gift_box";
      if (category === "cake") return type === "cake";
      if (category === "perfume") return type === "perfume";
      return true;
    })
    .slice(0, limit);
}

function getShopSlug(shop) {
  return shop?.slug || shop?.id || shop?.shopId || "";
}

function getShopTitle(shop) {
  return shop?.displayName || shop?.name || "Verified boutique";
}

function getShopSpecialty(shop) {
  if (Array.isArray(shop?.specialties) && shop.specialties.length) return shop.specialties[0];
  if (Array.isArray(shop?.fragranceIdentityTags) && shop.fragranceIdentityTags.length) return shop.fragranceIdentityTags[0];
  if (Array.isArray(shop?.categories) && shop.categories.length) return shop.categories[0];
  return "Perfume, cakes and gifting";
}

function Hero({ goToBuildBox, goToFragranceFinder, goToShop }) {
  return (
    <section className="home-rebuild-hero is-story" aria-labelledby="home-rebuild-title">
      <div className="home-rebuild-hero__copy">
        <TutiBadge tone="cyan" className="home-rebuild-hero__badge">
          AI-assisted premium gifting
        </TutiBadge>
        <h1 id="home-rebuild-title">Perfume, cake and gift boxes chosen with clarity.</h1>
        <p>
          Shop verified UAE boutiques, build a paired gift, or let Tuti guide you to a polished same-day surprise.
        </p>
        <div className="home-rebuild-hero__actions">
          <TutiButton size="lg" onClick={() => goToShop?.("gift_box")} icon={<ArrowRight size={18} />} iconPosition="right">
            Shop gifts
          </TutiButton>
          <TutiButton variant="soft" size="lg" onClick={goToBuildBox}>
            Build a box
          </TutiButton>
          <TutiButton variant="ghost" size="lg" onClick={goToFragranceFinder}>
            Find a scent
          </TutiButton>
        </div>
      </div>

      <TutiCard variant="commerce" padding="lg" className="home-rebuild-stage">
        <div className="home-rebuild-stage__grid" aria-label="Perfume, cake and gift box preview">
          <TutiMediaStage category="perfume" size="md" className="home-rebuild-stage__item home-rebuild-stage__item--perfume" />
          <TutiMediaStage category="cake" size="sm" className="home-rebuild-stage__item home-rebuild-stage__item--cake" />
          <TutiMediaStage category="gift_box" size="sm" className="home-rebuild-stage__item home-rebuild-stage__item--gift" />
        </div>
        <div className="home-rebuild-stage__note">
          <strong>One marketplace. One premium gift flow.</strong>
          <span>COD checkout, boutique fulfilment and curated product discovery.</span>
        </div>
      </TutiCard>
    </section>
  );
}

function ShortcutBar({ goToFragranceFinder, goToShop, goToShops }) {
  return (
    <nav className="home-shortcut-bar" aria-label="Quick gift categories">
      {SHORTCUTS.map(({ label, category, action, icon: Icon, tone }) => (
        <button
          key={label}
          type="button"
          onClick={() => {
            if (action === "finder") goToFragranceFinder?.();
            else if (action === "shops") goToShops?.();
            else goToShop?.(category);
          }}
        >
          <span className={`home-shortcut-bar__icon home-shortcut-bar__icon--${tone}`}>
            <Icon size={18} aria-hidden="true" />
          </span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function OccasionDiscovery({ collections = [], goToCollections, goToShop }) {
  const collectionCards = collections.slice(0, 3).map((collection) => ({
    title: collection.title || collection.name,
    text: collection.description || "A curated Tuti edit for thoughtful gifting.",
    badge: "Collection",
    onClick: goToCollections,
  }));
  const cards = collectionCards.length ? collectionCards : OCCASION_CARDS.map((card) => ({
    ...card,
    onClick: () => goToShop?.(card.category),
  }));

  return (
    <TutiSection
      eyebrow="Shop by intention"
      title="Find the right direction faster."
      subtitle="Compact edits for common gifting moments without turning the homepage into a maze."
      density="compact"
      className="home-rebuild-section"
    >
      <div className="home-decision-grid">
        {cards.map((card) => (
          <TutiCard as="button" type="button" variant="raised" padding="md" interactive className="home-decision-card" key={card.title} onClick={card.onClick}>
            <TutiBadge tone="champagne">{card.badge}</TutiBadge>
            <h3>{card.title}</h3>
            <p>{card.text}</p>
            <span>Explore <ArrowRight size={14} aria-hidden="true" /></span>
          </TutiCard>
        ))}
      </div>
    </TutiSection>
  );
}

function MomentStorySection({ goToBuildBox, goToShop }) {
  return (
    <section className="home-image-story home-image-story--moment" aria-labelledby="home-moment-title">
      <div className="home-image-story__media">
        <img src={giftSetCategoryImage} alt="Premium gift box with perfume, cake and chocolates" loading="lazy" />
      </div>
      <div className="home-image-story__copy">
        <TutiBadge tone="champagne">Curated moment</TutiBadge>
        <h2 id="home-moment-title">For the moments that deserve more than a message.</h2>
        <p>
          Perfume, cake and a personal note can become one polished gift flow, ready for the next celebration.
        </p>
        <div className="home-image-story__mini-grid" aria-label="Gift composition highlights">
          <span><strong>01</strong> Choose the scent</span>
          <span><strong>02</strong> Pair the treat</span>
        </div>
        <div className="home-image-story__actions">
          <TutiButton size="md" onClick={goToBuildBox}>Build a box</TutiButton>
          <TutiButton variant="ghost" size="md" onClick={() => goToShop?.("gift_box")}>Shop gift sets</TutiButton>
        </div>
      </div>
    </section>
  );
}

function ModernGiftingSection({ goToShop, goToShops }) {
  const benefits = [
    "Verified boutique sellers",
    "Same-day UAE delivery windows",
    "COD-ready premium checkout",
  ];

  return (
    <section className="home-image-story home-image-story--uae" aria-labelledby="home-uae-title">
      <div className="home-image-story__copy">
        <TutiBadge tone="champagne">UAE gifting</TutiBadge>
        <h2 id="home-uae-title">Made for modern UAE gifting.</h2>
        <p>
          From last-minute celebrations to planned surprises, Tuti brings verified boutiques into one premium experience.
        </p>
        <div className="home-image-story__benefits">
          {benefits.map((benefit) => <span key={benefit}>{benefit}</span>)}
        </div>
        <div className="home-image-story__actions">
          <TutiButton size="md" onClick={() => goToShop?.("all")}>Browse gifts</TutiButton>
          <TutiButton variant="ghost" size="md" onClick={goToShops}>View boutiques</TutiButton>
        </div>
      </div>
      <div className="home-image-story__gallery" aria-label="Perfume and patisserie gifting">
        <img src={perfumeCategoryImage} alt="Luxury perfume bottles on a dark counter" loading="lazy" />
        <img src={cakeCategoryImage} alt="Premium celebration cake and desserts" loading="lazy" />
        <img src={perfumeHeroImage} alt="Perfume bottles on a bright luxury counter" loading="lazy" />
      </div>
    </section>
  );
}

function BoutiqueSection({ goToSellerBrand, goToShops, shops = [] }) {
  const visibleShops = shops.slice(0, 4);

  return (
    <TutiSection
      eyebrow="Verified boutiques"
      title="Shop from trusted sellers."
      subtitle="Every seller discovery card keeps the focus on what they make, how they fulfil, and why they are worth browsing."
      action={<TutiButton variant="ghost" size="sm" onClick={goToShops}>View all boutiques</TutiButton>}
      density="compact"
      className="home-rebuild-section"
    >
      <div className={`home-boutique-grid home-boutique-grid--count-${Math.max(1, visibleShops.length)}`}>
        {(visibleShops.length ? visibleShops : [{ id: "seller-preview", name: "Tuti boutique preview" }]).map((shop) => (
          <TutiCard
            as="button"
            type="button"
            variant="commerce"
            padding="md"
            interactive
            className="home-boutique-card"
            key={shop.id || shop.shopId || shop.name}
            onClick={() => {
              const slug = getShopSlug(shop);
              if (slug) goToSellerBrand?.(slug);
              else goToShops?.();
            }}
          >
            <span className="home-boutique-card__mark" aria-hidden="true">
              {getShopTitle(shop).slice(0, 2).toUpperCase()}
            </span>
            <div>
              <TutiBadge tone="cyan">Verified</TutiBadge>
              <h3>{getShopTitle(shop)}</h3>
              <p>{shop.shortTagline || shop.tagline || "A curated boutique preparing premium products for thoughtful gifts."}</p>
            </div>
            <div className="home-boutique-card__meta">
              <span>{getShopSpecialty(shop)}</span>
              <span>{shop.rating ? `${shop.rating} rating` : "Quality reviewed"}</span>
            </div>
          </TutiCard>
        ))}
      </div>
    </TutiSection>
  );
}

function BuildGiftSection({ goToBuildBox }) {
  const steps = ["Choose perfume", "Add cake or treat", "Personalize", "Checkout COD"];

  return (
    <section className="home-build-module" aria-labelledby="home-build-title">
      <TutiCard variant="commerce" padding="lg" className="home-build-card">
        <div className="home-build-card__copy">
          <TutiBadge tone="champagne">Build a gift</TutiBadge>
          <h2 id="home-build-title">Create a premium box without guessing.</h2>
          <p>
            Start with a fragrance, pair it with a cake or dessert from the same boutique, add a note and move to checkout.
          </p>
          <div className="home-build-card__steps">
            {steps.map((step, index) => (
              <span key={step}><strong>{index + 1}</strong>{step}</span>
            ))}
          </div>
          <TutiButton size="lg" onClick={goToBuildBox} icon={<ArrowRight size={18} />} iconPosition="right">
            Build your box
          </TutiButton>
        </div>
        <div className="home-build-card__visual" aria-hidden="true">
          <TutiMediaStage category="perfume" size="sm" />
          <TutiMediaStage category="cake" size="sm" />
          <TutiMediaStage category="gift_box" size="sm" />
        </div>
      </TutiCard>
    </section>
  );
}

function FinalHomeCta({ goToBuildBox, goToShop }) {
  return (
    <section className="home-final-cta" aria-labelledby="home-final-cta-title">
      <TutiCard variant="section" padding="lg" className="home-final-cta__card">
        <div>
          <TutiBadge tone="cyan">Ready to gift</TutiBadge>
          <h2 id="home-final-cta-title">Start with the product. Finish with the moment.</h2>
          <p>Browse premium gifts or build a coordinated box for the next delivery window.</p>
        </div>
        <div className="home-final-cta__actions">
          <TutiButton size="lg" onClick={() => goToShop?.("all")}>Shop all gifts</TutiButton>
          <TutiButton variant="ghost" size="lg" onClick={goToBuildBox}>Build a box</TutiButton>
        </div>
      </TutiCard>
    </section>
  );
}

export function HomePage({
  collections = [],
  getShop,
  goToBuildBox,
  goToCollections,
  goToFragranceFinder,
  goToProduct,
  goToSellerBrand,
  goToShop,
  goToShops,
  onAddToCart,
  products = [],
  shops = [],
  topPerfumes = [],
}) {
  const luxuryPicks = useMemo(() => {
    const rankedIds = topPerfumes.map((item) => item.productId || item.id).filter(Boolean);
    const ranked = rankedIds
      .map((id) => products.find((product) => product.id === id))
      .filter(Boolean);
    const fallback = firstLiveProducts(products, 10);
    return [...ranked, ...fallback.filter((product) => !ranked.some((item) => item.id === product.id))].slice(0, 10);
  }, [products, topPerfumes]);

  const newArrivals = useMemo(() => firstLiveProducts([...products].reverse(), 10), [products]);
  const giftProducts = useMemo(() => pickProducts(products, "gift_box", 8), [products]);

  return (
    <main className="home-page home-rebuild-page">
      <Hero
        goToBuildBox={goToBuildBox}
        goToFragranceFinder={goToFragranceFinder}
        goToShop={goToShop}
      />

      <div className="home-rebuild-content">
        <ShortcutBar
          goToFragranceFinder={goToFragranceFinder}
          goToShop={goToShop}
          goToShops={goToShops}
        />

        <TutiSection
          eyebrow="Selected by Tuti"
          title="Luxury picks for meaningful moments."
          subtitle="A product-first edit of fragrance, cakes and gift boxes with clear actions."
          action={<TutiButton variant="ghost" size="sm" onClick={() => goToShop?.("all")}>View all gifts</TutiButton>}
          density="compact"
          className="home-rebuild-section home-rebuild-section--products"
        >
          <TutiProductRail
            products={luxuryPicks}
            getShop={getShop}
            variant="featured"
            onAddToCart={onAddToCart}
            onViewProduct={goToProduct}
            className="home-product-rail"
          />
        </TutiSection>

        <MomentStorySection
          goToBuildBox={goToBuildBox}
          goToShop={goToShop}
        />

        <OccasionDiscovery
          collections={collections}
          goToCollections={goToCollections}
          goToShop={goToShop}
        />

        {giftProducts.length ? (
          <TutiSection
            eyebrow="Ready to present"
            title="Gift boxes that do the thinking for you."
            subtitle="A compact rail for quick gift discovery without delaying the catalogue."
            action={<TutiButton variant="ghost" size="sm" onClick={() => goToShop?.("gift_box")}>View gift boxes</TutiButton>}
            density="compact"
            className="home-rebuild-section home-rebuild-section--gifts"
          >
            <TutiProductRail
              products={giftProducts}
              getShop={getShop}
              variant="related"
              onAddToCart={onAddToCart}
              onViewProduct={goToProduct}
              className="home-product-rail"
            />
          </TutiSection>
        ) : (
          <TutiSection
            eyebrow="Just landed"
            title="New arrivals from local boutiques."
            subtitle="Fresh discoveries, new gift ideas and recently added favourites."
            action={<TutiButton variant="ghost" size="sm" onClick={() => goToShop?.("all")}>View new picks</TutiButton>}
            density="compact"
            className="home-rebuild-section"
          >
            <TutiProductRail
              products={newArrivals}
              getShop={getShop}
              variant="related"
              onAddToCart={onAddToCart}
              onViewProduct={goToProduct}
              className="home-product-rail"
            />
          </TutiSection>
        )}

        <ModernGiftingSection
          goToShop={goToShop}
          goToShops={goToShops}
        />

        <BoutiqueSection
          goToSellerBrand={goToSellerBrand}
          goToShops={goToShops}
          shops={shops}
        />

        <BuildGiftSection goToBuildBox={goToBuildBox} />

        <TutiSection
          eyebrow="Why Tuti"
          title="Gifting with confidence."
          subtitle="The service promise stays simple: verified sellers, clear delivery expectations and COD-ready checkout."
          density="compact"
          className="home-rebuild-section home-rebuild-section--trust"
        >
          <TutiTrustStrip items={TRUST_ITEMS} variant="cards" />
        </TutiSection>

        <FinalHomeCta goToBuildBox={goToBuildBox} goToShop={goToShop} />
      </div>
    </main>
  );
}
