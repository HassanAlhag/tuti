import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  MapPin,
  Package,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Tag,
  Truck,
} from "lucide-react";
import { publicSellerBrandApi } from "@tuti/shared/api/client.js";
import { getLocalizedField, DEFAULT_LOCALE } from "@tuti/shared/utils/locale.js";
import { TutiBadge, TutiButton, TutiEmptyState } from "../../ui/customer/primitives/index.js";
import { TutiProductGrid, TutiTrustStrip, getProductCategory } from "../../ui/customer/commerce/index.js";
import {
  getBoutiqueCategoryChips,
  getBoutiqueDeliveryLabel,
  getBoutiqueFallbackCopy,
  getBoutiqueFallbackImage,
  getBoutiqueInitials,
  getShopCategories,
  normalizeKey,
} from "../boutiques/boutiqueDirectory.js";
import { trackPageView } from "../tracking/marketplaceTracking.js";
import { useSeoMeta } from "@tuti/shared/hooks/useSeoMeta.js";
import "../boutiques/boutiques.css";

function isImageUrl(value) {
  return /^(https?:\/\/|\/uploads\/|data:)/i.test(String(value || ""));
}

function safeDecodeSlug(value) {
  try {
    return decodeURIComponent(String(value || "")).trim();
  } catch {
    return String(value || "").trim();
  }
}

function getBrandHeading(profile, locale = DEFAULT_LOCALE) {
  return getLocalizedField(profile, "displayName", locale) || "Seller brand";
}

function getBoutiqueHue(seed) {
  const text = String(seed || "tuti");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 360;
  }
  return (hash + 360) % 360;
}

const PRODUCT_CATEGORY_TABS = [
  { key: "all", label: "All" },
  { key: "perfume", label: "Perfumes" },
  { key: "cake", label: "Cakes & Desserts" },
  { key: "gift_box", label: "Gift Boxes" },
];

export function SellerBrandPage({ slug, shops = [], onAddToCart, onNavigate, onViewProduct }) {
  const cleanSlug = safeDecodeSlug(slug);
  const pageViewKeyRef = useRef("");
  const [productCategory, setProductCategory] = useState("all");

  const profileQuery = useQuery({
    queryKey: ["seller-brand-public", cleanSlug],
    queryFn: () => publicSellerBrandApi.getProfile(cleanSlug),
    enabled: Boolean(cleanSlug),
  });

  const profile = profileQuery.data || null;

  const productsQuery = useQuery({
    queryKey: ["seller-brand-public-products", cleanSlug],
    queryFn: () => publicSellerBrandApi.getProducts(cleanSlug),
    enabled: Boolean(cleanSlug) && profileQuery.isSuccess && Boolean(profile),
  });

  const products = productsQuery.data || [];
  const loading = profileQuery.isLoading || (profileQuery.isSuccess && productsQuery.isLoading);
  const notFound = profileQuery.isError && !profileQuery.data;
  const errorMessage = profileQuery.error?.message || productsQuery.error?.message || "";

  // storefront.shops carries city/rating/category data the public brand-
  // profile API doesn't expose; matched by display name since that's the
  // one field both shapes reliably share (see boutiqueDirectory.js).
  const matchedShop = useMemo(() => {
    if (!profile) return null;
    const heading = normalizeKey(getBrandHeading(profile));
    return shops.find((shop) => normalizeKey(shop.name) === heading) || null;
  }, [profile, shops]);

  const categories = useMemo(
    () => (matchedShop ? getShopCategories(matchedShop) : []),
    [matchedShop]
  );
  const categoryChips = useMemo(
    () => (matchedShop ? getBoutiqueCategoryChips(matchedShop) : []),
    [matchedShop]
  );

  const filteredProducts = useMemo(() => {
    if (productCategory === "all") return products;
    return products.filter((product) => {
      const cat = getProductCategory(product);
      return cat === productCategory || (productCategory === "cake" && cat === "dessert");
    });
  }, [products, productCategory]);

  const availableProductTabs = useMemo(() => {
    if (categories.length < 2) return [];
    const present = new Set(products.map((p) => getProductCategory(p)));
    return PRODUCT_CATEGORY_TABS.filter((tab) => tab.key === "all" || present.has(tab.key) || (tab.key === "cake" && present.has("dessert")));
  }, [categories, products]);

  useSeoMeta({
    title: profile ? getBrandHeading(profile) : undefined,
    description: profile
      ? `${getBrandHeading(profile)} — ${profile.shortTagline || "Browse products and shop with cash on delivery on Tuti."}`
      : undefined,
    ogImage: isImageUrl(profile?.logoUrl) ? profile.logoUrl : undefined,
    canonical: profile ? `https://tuti.ae/sellers/${profile.slug || cleanSlug}` : undefined,
    jsonLd: profile ? {
      "@context": "https://schema.org",
      "@type": "Store",
      "name": getBrandHeading(profile),
      "description": profile.shortTagline || getBrandHeading(profile),
      "image": isImageUrl(profile.logoUrl) ? profile.logoUrl : undefined,
      "url": `https://tuti.ae/sellers/${profile.slug || cleanSlug}`,
      "address": matchedShop?.city ? { "@type": "PostalAddress", "addressLocality": matchedShop.city, "addressCountry": "AE" } : undefined,
    } : undefined,
  });

  useEffect(() => {
    if (!profile?.slug && !cleanSlug) return;
    if (!profileQuery.isSuccess || !profile) return;
    const pageViewKey = [profile.slug || cleanSlug, profile.published ? "published" : "unpublished"].join("|");
    if (pageViewKeyRef.current === pageViewKey) return;
    pageViewKeyRef.current = pageViewKey;
    void trackPageView({
      eventType: "seller_brand_view",
      source: "web_seller_brand_page",
      route: typeof window !== "undefined" ? window.location.pathname : "",
      context: {
        sellerShopId: matchedShop?.id || null,
        metadata: {
          sellerSlug: cleanSlug,
        },
      },
    });
  }, [cleanSlug, profile, profileQuery.isSuccess, matchedShop]);

  function goHome() {
    if (onNavigate) { onNavigate("/"); return; }
    window.location.href = "/";
  }

  function goShop() {
    if (onNavigate) { onNavigate("/shop"); return; }
    window.location.href = "/shop";
  }

  function goBrandHome() {
    if (onNavigate) { onNavigate("/shops"); return; }
    window.location.href = "/shops";
  }

  function goSupport() {
    if (onNavigate) { onNavigate("/support"); return; }
    window.location.href = "/support";
  }

  function scrollToProducts() {
    document.getElementById("boutique-products")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (loading) {
    return (
      <main className="page-shell boutique-profile-page">
        <TutiEmptyState icon={<Sparkles size={26} />} title="Loading boutique…" />
      </main>
    );
  }

  if (notFound || !profile) {
    return (
      <main className="page-shell boutique-profile-page">
        <section className="boutique-profile-not-found">
          <Store size={26} />
          <h1>{cleanSlug ? "Boutique page unavailable" : "Boutique link is incomplete"}</h1>
          <p>
            {cleanSlug
              ? "This boutique's public page is not published yet, or the link is no longer available."
              : "The boutique link is missing an identifier."}
          </p>
          <div className="boutique-profile-not-found-actions">
            <TutiButton size="sm" icon={<ArrowLeft size={15} />} onClick={goHome}>Back to home</TutiButton>
            <TutiButton variant="ghost" size="sm" onClick={goShop}>Browse products</TutiButton>
            <TutiButton variant="ghost" size="sm" onClick={goBrandHome}>Browse boutiques</TutiButton>
          </div>
        </section>
      </main>
    );
  }

  if (productsQuery.isError && !productsQuery.data) {
    return (
      <main className="page-shell boutique-profile-page">
        <section className="boutique-profile-not-found">
          <Store size={26} />
          <h1>Boutique page unavailable</h1>
          <p>{errorMessage || "We could not load this boutique right now."}</p>
          <div className="boutique-profile-not-found-actions">
            <TutiButton size="sm" icon={<ArrowLeft size={15} />} onClick={goHome}>Back to home</TutiButton>
            <TutiButton variant="ghost" size="sm" onClick={goBrandHome}>Browse boutiques</TutiButton>
          </div>
        </section>
      </main>
    );
  }

  const sellerHeading = getBrandHeading(profile);
  const hasBanner = isImageUrl(profile.bannerUrl);
  const hasLogo = isImageUrl(profile.logoUrl);
  const fallbackImage = matchedShop ? getBoutiqueFallbackImage(matchedShop) : "";
  const intro = getLocalizedField(profile, "shortTagline", DEFAULT_LOCALE)
    || getLocalizedField(profile, "brandStory", DEFAULT_LOCALE)
    || (matchedShop ? getBoutiqueFallbackCopy(matchedShop) : "This boutique is preparing its full public profile.");
  const brandStory = getLocalizedField(profile, "brandStory", DEFAULT_LOCALE);
  const deliveryLabel = matchedShop ? getBoutiqueDeliveryLabel(matchedShop) : "";
  const publicShop = { name: sellerHeading };

  const trustItems = [
    { icon: <ShieldCheck size={18} />, title: "Verified boutique", description: "Reviewed by Tuti before going live." },
    { icon: <Package size={18} />, title: "Boutique-owned preparation", description: `Prepared and packaged by ${sellerHeading}, not combined with other boutiques.` },
    { icon: <BadgeCheck size={18} />, title: "COD at launch", description: "Cash on delivery is available for every order." },
    ...(deliveryLabel ? [{ icon: <Truck size={18} />, title: "Delivery", description: deliveryLabel }] : []),
  ];

  return (
    <main className="page-shell boutique-profile-page">
      <section className="boutique-profile-hero">
        <div
          className={hasBanner ? "boutique-profile-cover" : "boutique-profile-cover boutique-profile-cover--tinted"}
          style={!hasBanner ? { "--boutique-hue": getBoutiqueHue(profile.slug || sellerHeading) } : undefined}
        >
          {hasBanner ? <img src={profile.bannerUrl} alt="" /> : (fallbackImage ? <img src={fallbackImage} alt="" /> : null)}
        </div>

        <div className="boutique-profile-card">
          <div className="boutique-profile-logo">
            {hasLogo ? <img src={profile.logoUrl} alt={`${sellerHeading} logo`} /> : getBoutiqueInitials(sellerHeading)}
          </div>

          <div>
            <div className="boutique-profile-title-row">
              <h1>{sellerHeading}</h1>
              <TutiBadge tone="cyan" icon={<BadgeCheck size={13} />}>Verified boutique</TutiBadge>
            </div>

            <div className="boutique-profile-meta">
              {categoryChips.map((chip) => <span key={chip}>{chip}</span>)}
              {matchedShop?.city ? <span><MapPin size={13} aria-hidden="true" /> {matchedShop.city}</span> : null}
              {matchedShop?.serviceRating ? <span><Star size={13} aria-hidden="true" /> {matchedShop.serviceRating} rating</span> : null}
            </div>

            <p className="boutique-profile-intro">{intro}</p>

            <div className="boutique-profile-actions">
              <TutiButton size="md" icon={<ShoppingBag size={16} />} iconPosition="right" onClick={scrollToProducts}>
                Browse products
              </TutiButton>
              <TutiButton variant="ghost" size="md" onClick={goSupport}>Contact support</TutiButton>
            </div>
          </div>
        </div>
      </section>

      <TutiTrustStrip items={trustItems} variant="cards" className="boutique-profile-trust" />

      <section className="boutique-profile-grid">
        <article className="boutique-profile-panel">
          <div className="boutique-profile-panel-head">
            <div>
              <span className="boutique-profile-panel-eyebrow">About the boutique</span>
              <h2>Story and preparation</h2>
            </div>
            <span className="boutique-profile-panel-icon" aria-hidden="true"><Store size={18} /></span>
          </div>

          <p>{brandStory || (matchedShop ? getBoutiqueFallbackCopy(matchedShop) : "This boutique is preparing its brand story. Explore its available products below.")}</p>

          {categoryChips.length ? (
            <div className="boutique-profile-category-list">
              {categoryChips.map((chip) => <TutiBadge tone="champagne" key={chip}>{chip}</TutiBadge>)}
            </div>
          ) : null}

          <div className="boutique-profile-note">
            <ShieldCheck size={16} aria-hidden="true" />
            <p>Each boutique prepares and packages its own items. Tuti does not combine products from multiple boutiques into one physical box.</p>
          </div>
        </article>

        <article className="boutique-profile-panel">
          <div className="boutique-profile-panel-head">
            <div>
              <span className="boutique-profile-panel-eyebrow">Good to know</span>
              <h2>What shoppers should know</h2>
            </div>
          </div>

          <div className="boutique-profile-info-rows">
            <div className="boutique-profile-info-row">
              <span className="boutique-profile-info-row__icon" aria-hidden="true"><BadgeCheck size={15} /></span>
              <div>
                <p className="boutique-profile-info-row__title">Cash on Delivery at launch</p>
                <p className="boutique-profile-info-row__desc">Available for every order from this boutique.</p>
              </div>
            </div>

            <div className="boutique-profile-info-row">
              <span className="boutique-profile-info-row__icon" aria-hidden="true"><Package size={15} /></span>
              <div>
                <p className="boutique-profile-info-row__title">Boutique-owned preparation</p>
                <p className="boutique-profile-info-row__desc">Prepared and packaged by {sellerHeading} alone.</p>
              </div>
            </div>

            {deliveryLabel ? (
              <div className="boutique-profile-info-row">
                <span className="boutique-profile-info-row__icon" aria-hidden="true"><Truck size={15} /></span>
                <div>
                  <p className="boutique-profile-info-row__title">Delivery</p>
                  <p className="boutique-profile-info-row__desc">{deliveryLabel}.</p>
                </div>
              </div>
            ) : null}

            {categoryChips.length ? (
              <div className="boutique-profile-info-row">
                <span className="boutique-profile-info-row__icon" aria-hidden="true"><Tag size={15} /></span>
                <div>
                  <p className="boutique-profile-info-row__title">What this boutique sells</p>
                  <p className="boutique-profile-info-row__desc">{categoryChips.join(", ")}.</p>
                </div>
              </div>
            ) : null}
          </div>
        </article>
      </section>

      <section className="boutique-profile-products" id="boutique-products">
        <div className="boutique-profile-products-head">
          <div>
            <span className="boutique-profile-panel-eyebrow">Live catalog</span>
            <h2>Products from {sellerHeading}</h2>
          </div>
        </div>

        {availableProductTabs.length ? (
          <div className="boutique-profile-category-tabs" role="group" aria-label="Filter products by category">
            {availableProductTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`boutique-directory-filter${productCategory === tab.key ? " is-active" : ""}`}
                onClick={() => setProductCategory(tab.key)}
                aria-pressed={productCategory === tab.key}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}

        <TutiProductGrid
          products={filteredProducts}
          getShop={() => publicShop}
          variant="catalog"
          onAddToCart={onAddToCart}
          onViewProduct={onViewProduct}
          emptyState={<TutiEmptyState icon={<Package size={26} />} title="This boutique has no live products yet." />}
        />

        <p className="boutique-profile-preparation">
          <Package size={15} aria-hidden="true" />
          Prepared and packaged by {sellerHeading}.
        </p>
      </section>
    </main>
  );
}
