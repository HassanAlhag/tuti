import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  Globe2,
  Package,
  ShieldCheck,
  Sparkles,
  Store,
  Tag,
  ShoppingBag,
  Users,
} from "lucide-react";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { publicSellerBrandApi } from "@tuti/shared/api/client.js";
import { ProductCardRouter } from "../storefront/components/ProductCardRouter.jsx";
import { trackPageView } from "../tracking/marketplaceTracking.js";
import { useSeoMeta } from "@tuti/shared/hooks/useSeoMeta.js";

function isImageUrl(value) {
  return /^(https?:\/\/|\/uploads\/|data:)/i.test(String(value || ""));
}

function normalizeProducts(products = []) {
  return products.map((product) => ({
    ...product,
    status: product.status || "Live",
  }));
}

function safeDecodeSlug(value) {
  try {
    return decodeURIComponent(String(value || "")).trim();
  } catch {
    return String(value || "").trim();
  }
}

function getBrandHeading(profile) {
  return profile?.displayName || "Seller brand";
}

export function SellerBrandPage({ slug, onAddToCart, onNavigate, onViewProduct }) {
  const cleanSlug = safeDecodeSlug(slug);
  const pageViewKeyRef = useRef("");

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

  const products = useMemo(() => normalizeProducts(productsQuery.data || []), [productsQuery.data]);
  const loading = profileQuery.isLoading || (profileQuery.isSuccess && productsQuery.isLoading);
  const notFound = profileQuery.isError && !profileQuery.data;
  const errorMessage = profileQuery.error?.message || productsQuery.error?.message || "";

  useSeoMeta({
    title: profile ? getBrandHeading(profile) : undefined,
    description: profile
      ? `${getBrandHeading(profile)} — ${profile.tagline || "Browse products and shop with cash on delivery on Tuti."}`
      : undefined,
    ogImage: isImageUrl(profile?.logoUrl) ? profile.logoUrl : undefined,
    canonical: profile ? `https://tuti.ae/sellers/${profile.slug || cleanSlug}` : undefined,
    jsonLd: profile ? {
      "@context": "https://schema.org",
      "@type": "Store",
      "name": getBrandHeading(profile),
      "description": profile.tagline || getBrandHeading(profile),
      "image": isImageUrl(profile.logoUrl) ? profile.logoUrl : undefined,
      "url": `https://tuti.ae/sellers/${profile.slug || cleanSlug}`,
      "address": profile.city ? { "@type": "PostalAddress", "addressLocality": profile.city, "addressCountry": "AE" } : undefined,
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
        sellerShopId: profile.shopId || null,
        metadata: {
          sellerSlug: cleanSlug,
        },
      },
    });
  }, [cleanSlug, profile, profileQuery.isSuccess]);

  function goHome() {
    if (onNavigate) {
      onNavigate("/");
      return;
    }
    window.location.href = "/";
  }

  function goShop() {
    if (onNavigate) {
      onNavigate("/shop");
      return;
    }
    window.location.href = "/shop";
  }

  function goBrandHome() {
    if (onNavigate) {
      onNavigate("/shops");
      return;
    }
    window.location.href = "/shops";
  }

  if (loading) {
    return (
      <main className="page-shell seller-brand-page">
        <EmptyState icon={Sparkles} text="Loading seller brand page…" />
      </main>
    );
  }

  if (notFound || !profile) {
    return (
      <main className="page-shell seller-brand-page">
        <section className="not-found-panel seller-brand-state">
          <Store size={26} />
          <h1>{cleanSlug ? "Seller page unavailable" : "Seller page link is incomplete"}</h1>
          <p>
            {cleanSlug
              ? "This seller brand page is not published yet, or the link is no longer available."
              : "The seller page link is missing a brand slug."}
          </p>
          <div className="seller-brand-actions">
            <button className="primary-action" type="button" onClick={goHome}>
              <ArrowLeft size={16} />
              Back to home
            </button>
            <button className="secondary-action" type="button" onClick={goShop}>
              Browse perfumes
            </button>
            <button className="secondary-action" type="button" onClick={goBrandHome}>
              Browse sellers
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (productsQuery.isError && !productsQuery.data) {
    return (
      <main className="page-shell seller-brand-page">
        <section className="not-found-panel seller-brand-state">
          <Store size={26} />
          <h1>Seller page unavailable</h1>
          <p>{errorMessage || "We could not load this seller page right now."}</p>
          <div className="seller-brand-actions">
            <button className="primary-action" type="button" onClick={goHome}>
              <ArrowLeft size={16} />
              Back to home
            </button>
            <button className="secondary-action" type="button" onClick={goBrandHome}>
              Browse sellers
            </button>
          </div>
        </section>
      </main>
    );
  }

  const hasBanner = isImageUrl(profile.bannerUrl);
  const hasLogo = isImageUrl(profile.logoUrl);
  const publicShop = { name: profile.displayName || "Tuti seller" };
  const hasStory = Boolean(profile.brandStory || profile.brandStoryAr);
  const hasTrustContent = Boolean((profile.trustBadges || []).length || (profile.sellerPolicies || []).length);
  const sellerHeading = getBrandHeading(profile);

  return (
    <main className="page-shell seller-brand-page">
      <section className="seller-brand-hero">
        <div
          className={hasBanner ? "seller-brand-banner seller-brand-banner--image" : "seller-brand-banner"}
          style={hasBanner ? { backgroundImage: `linear-gradient(180deg, rgba(12,25,22,0.32), rgba(12,25,22,0.76)), url(${profile.bannerUrl})` } : undefined}
        >
          {!hasBanner && (
            <div className="seller-brand-banner-copy">
              <span className="seller-brand-banner-kicker">Verified boutique</span>
              <strong>{profile.shortTagline || sellerHeading}</strong>
            </div>
          )}

          <div className="seller-brand-hero-card">
            <div className="seller-brand-logo">
              {hasLogo ? (
                <img src={profile.logoUrl} alt={`${getBrandHeading(profile)} logo`} />
              ) : (
                <span>{String(profile.logoUrl || profile.displayName || "TS").slice(0, 2).toUpperCase()}</span>
              )}
            </div>

            <div className="seller-brand-copy">
              <div className="seller-brand-title-row">
                <div className="seller-brand-title-stack">
                  <h1>{sellerHeading}</h1>
                  {profile.displayNameAr ? <strong lang="ar" dir="auto">{profile.displayNameAr}</strong> : null}
                </div>
                <span className="seller-brand-pill seller-brand-pill--brand">
                  <BadgeCheck size={14} />
                  Verified boutique
                </span>
              </div>

              {profile.shortTagline ? <p className="seller-brand-tagline">{profile.shortTagline}</p> : null}
              {profile.shortTaglineAr ? <p className="seller-brand-tagline" lang="ar" dir="auto">{profile.shortTaglineAr}</p> : null}
            </div>

            <div className="seller-brand-chip-row">
              {(profile.fragranceIdentityTags || []).slice(0, 6).map((tag) => (
                <span className="seller-brand-pill" key={tag}>
                  <Tag size={13} />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="seller-brand-detail-grid">
        <article className="seller-brand-panel">
          <div className="seller-brand-panel-head">
            <span className="seller-brand-panel-eyebrow">About the brand</span>
            <h2>Story and identity</h2>
          </div>

          {hasStory ? (
            <div className="seller-brand-story-block">
              {profile.brandStory ? <p className="seller-brand-story">{profile.brandStory}</p> : null}
              {profile.brandStoryAr ? <p className="seller-brand-story" lang="ar" dir="auto">{profile.brandStoryAr}</p> : null}
            </div>
          ) : (
            <p className="seller-brand-story seller-brand-story--fallback">
              This verified boutique is preparing its full brand story. Explore its available products below.
            </p>
          )}

          {(profile.specialties || []).length ? (
            <div className="seller-brand-list">
              <div className="seller-brand-list-head">
                <Users size={15} />
                <strong>Specialties</strong>
              </div>
              <div className="seller-brand-pill-row">
                {profile.specialties.map((item) => (
                  <span className="seller-brand-pill" key={item}>{item}</span>
                ))}
              </div>
            </div>
          ) : null}
        </article>

        <article className="seller-brand-panel">
          <div className="seller-brand-panel-head">
            <span className="seller-brand-panel-eyebrow">Trust and policy</span>
            <h2>What shoppers should know</h2>
          </div>

          {(profile.trustBadges || []).length ? (
            <div className="seller-brand-list">
              <div className="seller-brand-list-head">
                <ShieldCheck size={15} />
                <strong>Trust badges</strong>
              </div>
              <div className="seller-brand-pill-row">
                {profile.trustBadges.map((item) => (
                  <span className="seller-brand-pill" key={item}>{item}</span>
                ))}
              </div>
            </div>
          ) : null}

          {(profile.sellerPolicies || []).length ? (
            <div className="seller-brand-list">
              <div className="seller-brand-list-head">
                <Package size={15} />
                <strong>Helpful policies</strong>
              </div>
              <div className="seller-brand-policy-list">
                {profile.sellerPolicies.map((policy, index) => (
                  <div className="seller-brand-policy-row" key={`${policy.label || policy.value || index}`}>
                    <strong>{policy.label || "Policy"}</strong>
                    <span>{policy.value || ""}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {(profile.socialLinks || []).length ? (
            <div className="seller-brand-list">
              <div className="seller-brand-list-head">
                <Globe2 size={15} />
                <strong>Find the brand</strong>
              </div>
              <div className="seller-brand-link-list">
                {profile.socialLinks.map((link, index) => (
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    key={`${link.label || link.url || index}`}
                  >
                    <Globe2 size={14} />
                    <span>{link.label || link.url}</span>
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          {!hasTrustContent && !(profile.socialLinks || []).length ? (
            <p className="seller-brand-story seller-brand-story--fallback">
              More boutique details will appear here as this seller expands its public profile.
            </p>
          ) : null}
        </article>
      </section>

      <section className="seller-brand-products">
        <div className="seller-brand-section-head">
          <div>
            <span className="seller-brand-panel-eyebrow">Live catalog</span>
            <h2>Products from {sellerHeading}</h2>
          </div>
          <button className="secondary-action compact" type="button" onClick={goShop}>
            <ShoppingBag size={14} />
            {sellerHeading ? `Browse products from ${sellerHeading}` : "Explore products"}
          </button>
        </div>

        {products.length ? (
          <div className="product-grid">
            {products.map((product) => (
              <ProductCardRouter
                key={product.id}
                product={product}
                shop={publicShop}
                onAddToCart={onAddToCart}
                onRateProduct={onViewProduct}
                onViewProduct={onViewProduct}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={Package} text="No products available yet. Check back soon." />
        )}
      </section>
    </main>
  );
}
