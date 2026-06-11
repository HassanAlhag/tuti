import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Package,
  Sparkles,
  Star,
  Store,
  Tag,
} from "lucide-react";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { BottleArt } from "@tuti/shared/components/BottleArt.jsx";
import { bayesianScore } from "@tuti/shared/utils/rating.js";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import { publicCollectionsApi } from "@tuti/shared/api/client.js";
import { trackPageView } from "../tracking/marketplaceTracking.js";

function safeDecodeSlug(value) {
  try {
    return decodeURIComponent(String(value || "")).trim();
  } catch {
    return String(value || "").trim();
  }
}

function isImageUrl(value) {
  return /^(https?:\/\/|\/uploads\/|data:)/i.test(String(value || ""));
}

function toTitleLabel(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="collection-breadcrumbs">
      {items.map((item, index) => (
        <div className="collection-breadcrumbs-item" key={`${item.label}-${index}`}>
          {item.href ? (
            <a href={item.href}>{item.label}</a>
          ) : (
            <span>{item.label}</span>
          )}
          {index < items.length - 1 ? <span className="collection-breadcrumbs-sep">/</span> : null}
        </div>
      ))}
    </nav>
  );
}

function CollectionProductCard({ item, onViewProduct }) {
  const product = item?.product || {};
  const shop = item?.shop || {};
  const image = item?.imageUrl || product.imagePath || "";
  const hasImage = isImageUrl(image);
  const score = bayesianScore(product.rating, product.reviews);
  const price = formatCurrency(product.price || 0);
  const title = item?.title || product.name || "Featured product";
  const subtitle = item?.subtitle || product.family || product.collection || product.description || "";
  const isCustomTitle = Boolean(item?.title && item.title !== product.name);

  function viewProduct() {
    if (!product?.id || !onViewProduct) return;
    onViewProduct(product.id);
  }

  return (
    <button className="collection-item-card collection-item-card--product" type="button" onClick={viewProduct}>
      <div className={hasImage ? "collection-item-media collection-item-media--image" : "collection-item-media"}>
        {hasImage ? (
          <img alt="" src={image} />
        ) : (
          <div className="collection-item-media-fallback">
            <BottleArt product={product} />
          </div>
        )}
        {item?.badgeLabel ? <span className="collection-item-pill collection-item-pill--badge">{item.badgeLabel}</span> : null}
      </div>

      <div className="collection-item-copy">
        <div className="collection-item-head">
          <strong>{title}</strong>
        </div>

        {subtitle ? <p>{subtitle}</p> : null}
        {isCustomTitle && product.name ? (
          <small className="collection-item-kicker">Product: {product.name}</small>
        ) : null}

        <div className="collection-item-meta">
          <span>{shop?.name || "Marketplace seller"}</span>
          <span>{product.family || product.category || "Perfume"}</span>
        </div>

        <div className="collection-item-rating">
          <Star size={14} fill="currentColor" />
          <strong>{score}</strong>
          <span>{product.reviews || 0} reviews</span>
        </div>

        <div className="collection-item-footer">
          <div className="collection-item-price">
            <strong>{price}</strong>
            {product.originalPrice ? <del>{formatCurrency(product.originalPrice)}</del> : null}
          </div>
          <span className="collection-item-link">
            View product <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </button>
  );
}

function CollectionSellerCard({ item, onNavigate }) {
  const seller = item?.seller || {};
  const image = item?.imageUrl || seller.bannerUrl || seller.logoUrl || "";
  const hasImage = isImageUrl(image);
  const title = item?.title || seller.displayName || "Featured seller";
  const subtitle = item?.subtitle || seller.shortTagline || "";
  const tags = [...(seller.trustBadges || []), ...(seller.fragranceIdentityTags || [])]
    .filter(Boolean)
    .slice(0, 4);

  function openSellerPage() {
    if (!seller?.slug || !onNavigate) return;
    onNavigate(`/sellers/${seller.slug}`);
  }

  return (
    <button className="collection-item-card collection-item-card--seller" type="button" onClick={openSellerPage}>
      <div className={hasImage ? "collection-item-media collection-item-media--image" : "collection-item-media collection-item-media--seller"}>
        {hasImage ? (
          <img alt="" src={image} />
        ) : (
          <span className="collection-item-media-fallback">
            {String(seller.logoUrl || title || "TS").slice(0, 2).toUpperCase()}
          </span>
        )}
        {item?.badgeLabel ? <span className="collection-item-pill collection-item-pill--badge">{item.badgeLabel}</span> : null}
      </div>

      <div className="collection-item-copy">
        <div className="collection-item-head">
          <strong>{title}</strong>
          {seller.published ? (
            <span className="collection-item-pill collection-item-pill--brand">
              <BadgeCheck size={13} />
              Verified boutique
            </span>
          ) : null}
        </div>

        {subtitle ? <p>{subtitle}</p> : null}
        {seller.displayNameAr ? <small lang="ar" dir="auto">{seller.displayNameAr}</small> : null}

        {tags.length ? (
          <div className="collection-item-tags">
            {tags.map((tag) => (
              <span className="collection-item-pill" key={tag}>
                <Tag size={12} />
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="collection-item-footer">
          <div className="collection-item-price">
            <strong>Brand page</strong>
            <span>{seller.specialties?.[0] || "Curated perfume house"}</span>
          </div>
          <span className="collection-item-link">
            Visit brand page <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </button>
  );
}

export function CollectionPage({ slug, onNavigate, onViewProduct }) {
  const cleanSlug = safeDecodeSlug(slug);
  const pageViewKeyRef = useRef("");

  const collectionQuery = useQuery({
    queryKey: ["public-collection", cleanSlug],
    queryFn: () => publicCollectionsApi.getBySlug(cleanSlug),
    enabled: Boolean(cleanSlug),
    retry: 0,
  });

  const collection = collectionQuery.data || null;
  const items = useMemo(
    () => (Array.isArray(collection?.items) ? collection.items.filter(Boolean) : []),
    [collection?.items]
  );
  const visibleItems = useMemo(
    () => items.filter((item) => (
      (item.type === "product" && Boolean(item?.product?.id))
      || (item.type === "seller" && Boolean(item?.seller?.slug))
    )),
    [items]
  );
  const loading = collectionQuery.isLoading;
  const notFound = !loading && (!cleanSlug || collectionQuery.isError || !collection);
  const bannerUrl = collection?.bannerUrl || collection?.mobileBannerUrl || "";
  const mobileBannerUrl = collection?.mobileBannerUrl || collection?.bannerUrl || "";
  const heroPlacement = collection?.placementKey ? toTitleLabel(collection.placementKey) : "Curated collection";
  const collectionTitle = collection?.title || collection?.titleAr || "Curated collection";

  useEffect(() => {
    if (!collectionQuery.isSuccess || !collection) return;
    const pageViewKey = [collection.id || collection.slug || cleanSlug, collection.placementKey || ""].join("|");
    if (pageViewKeyRef.current === pageViewKey) return;
    pageViewKeyRef.current = pageViewKey;
    void trackPageView({
      eventType: "collection_view",
      source: "web_collection_page",
      route: typeof window !== "undefined" ? window.location.pathname : "",
      context: {
        collectionId: collection.id || null,
        metadata: {
          collectionSlug: cleanSlug,
        },
      },
    });
  }, [cleanSlug, collection, collectionQuery.isSuccess]);

  function goHome() {
    if (onNavigate) {
      onNavigate("/");
      return;
    }
    window.location.href = "/";
  }

  function goCollections() {
    if (onNavigate) {
      onNavigate("/collections");
      return;
    }
    window.location.href = "/collections";
  }

  if (loading) {
    return (
      <main className="page-shell collection-page">
        <EmptyState icon={Sparkles} text="Loading collection…" />
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="page-shell collection-page">
        <section className="not-found-panel collection-state">
          <Store size={26} />
          <h1>{cleanSlug ? "Collection unavailable" : "Collection link is incomplete"}</h1>
          <p>
            {cleanSlug
              ? "This collection is not published yet, or the link is no longer available."
              : "The collection link is missing a slug."}
          </p>
          <div className="collection-state-actions">
            <button className="primary-action" type="button" onClick={goHome}>
              <ArrowLeft size={16} />
              Back to home
            </button>
            <button className="secondary-action" type="button" onClick={goCollections}>
              Browse collections
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell collection-page">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Collections", href: "/collections" },
          { label: collectionTitle },
        ]}
      />

      <section className="collection-hero">
        <div className="collection-hero-banner">
          {bannerUrl ? (
            <picture>
              {mobileBannerUrl && mobileBannerUrl !== bannerUrl ? (
                <source media="(max-width: 640px)" srcSet={mobileBannerUrl} />
              ) : null}
              <img alt={`${collection.title || collection.titleAr || "Collection"} banner`} src={bannerUrl} />
            </picture>
          ) : (
            <div className="collection-hero-banner-fallback">
              <Sparkles size={34} />
              <span>Curated by Tuti</span>
            </div>
          )}

          <div className="collection-hero-overlay">
            <span className="eyebrow">Curated by Tuti</span>
            <h1>{collectionTitle}</h1>
            {collection.titleAr ? <strong lang="ar" dir="auto">{collection.titleAr}</strong> : null}
            {collection.subtitle ? <p>{collection.subtitle}</p> : null}
            {collection.subtitleAr ? <p lang="ar" dir="auto">{collection.subtitleAr}</p> : null}

            <div className="collection-hero-meta">
              {collection.theme ? (
                <span className="collection-hero-pill">
                  <Sparkles size={13} />
                  {collection.theme}
                </span>
              ) : null}
              {collection.placementKey ? (
                <span className="collection-hero-pill">
                  <Package size={13} />
                  {heroPlacement}
                </span>
              ) : null}
              <span className="collection-hero-pill">
                <BadgeCheck size={13} />
                Curated collection
              </span>
            </div>
          </div>
        </div>
      </section>

      {collection.description || collection.descriptionAr ? (
        <section className="collection-story">
          {collection.description ? <p className="collection-story-lede">{collection.description}</p> : null}
          {collection.descriptionAr ? <p className="collection-story-lede" lang="ar" dir="auto">{collection.descriptionAr}</p> : null}
        </section>
      ) : null}

      <section className="collection-items-section">
        <div className="collection-section-head">
          <div>
            <span className="eyebrow">Collection items</span>
            <h2>Shop the edit</h2>
          </div>
        </div>

        {visibleItems.length ? (
          <div className="collection-items-grid">
            {visibleItems.map((item, index) => {
              if (item.type === "seller" && item?.seller?.slug) {
                return (
                  <CollectionSellerCard
                    key={`${item.type}-${item.seller.slug}-${index}`}
                    item={item}
                    onNavigate={onNavigate}
                  />
                );
              }

              if (item.type === "product" && item?.product?.id) {
                return (
                  <CollectionProductCard
                    key={`${item.type}-${item.product.id}-${index}`}
                    item={item}
                    onViewProduct={onViewProduct}
                  />
                );
              }

              return null;
            })}
          </div>
        ) : (
          <section className="collection-empty-state">
            <EmptyState icon={Package} text="No items available yet." />
          </section>
        )}
      </section>
    </main>
  );
}
