import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkles, Tag } from "lucide-react";
import { publicMerchandisingApi } from "@tuti/shared/api/client.js";
import { BottleArt } from "@tuti/shared/components/BottleArt.jsx";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import cakeCategoryImage from "../../assets/category-cakes.jpg";
import completeGiftImage from "../../assets/home-ch4-complete.png";
import perfumeImage from "../../assets/category-perfumes.jpg";
import { trackPlacementClick, usePlacementImpressionTracker } from "../tracking/marketplaceTracking.js";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function isRenderableImageUrl(value) {
  return /^(https?:\/\/|\/uploads\/|data:)/i.test(String(value || ""));
}

function getProductTitle(placement, product) {
  return normalizeText(placement?.title) || normalizeText(product?.name) || "Featured fragrance";
}

function getProductSubtitle(placement, product, shop) {
  return (
    normalizeText(placement?.subtitle) ||
    normalizeText(product?.family) ||
    normalizeText(product?.collection) ||
    normalizeText(product?.description) ||
    normalizeText(shop?.name) ||
    "Curated fragrance"
  );
}

function getProductImage(placement, product) {
  const override = normalizeText(placement?.imageUrl);
  if (isRenderableImageUrl(override)) return override;
  const fallback = normalizeText(product?.imagePath);
  return isRenderableImageUrl(fallback) ? fallback : "";
}

function getProductFallbackImage(product) {
  const category = normalizeText(product?.category);
  if (category === "cake" || category === "dessert") return cakeCategoryImage;
  if (category === "gift_box" || category === "bundle") return completeGiftImage;
  return perfumeImage;
}

function getProductShopName(shop) {
  return normalizeText(shop?.name) || "Boutique seller";
}

function humanizeProductBadge(product) {
  const releaseType = normalizeText(product?.releaseType);
  if (releaseType) return releaseType;
  const category = normalizeText(product?.category);
  if (!category) return "";
  if (category === "gift_box" || category === "bundle") return "Gift Set";
  if (category === "cake" || category === "dessert") return "Treat";
  if (category === "perfume") return "Perfume";
  return category.replace(/_/g, " ");
}

function buildProductTags(product) {
  const source = [
    normalizeText(product?.family),
    normalizeText(product?.gender),
    normalizeText(product?.collection),
    ...(Array.isArray(product?.notes) ? product.notes : []),
    ...(Array.isArray(product?.flavors) ? product.flavors : []),
    ...(Array.isArray(product?.occasionTags) ? product.occasionTags : []),
  ];
  return [...new Set(source.filter(Boolean).map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 3);
}

function makeProductTrackingPayload(placement, placementKey, index) {
  const product = placement?.product || {};
  const shop = placement?.shop || {};
  return {
    placementId: placement?.id || placement?.placementId || null,
    placementType: "homepage_rail",
    placementKey: placement?.placementKey || placementKey,
    productId: product?.id || null,
    shopId: shop?.id || null,
    sellerShopId: shop?.id || null,
    metadata: {
      productSlug: normalizeText(product?.slug),
      cardIndex: index,
      listPosition: index + 1,
    },
  };
}

/* 1 product — full editorial feature */
function ProductEditorial({ placement, placementKey, eyebrow, onViewProduct }) {
  const product = placement?.product || {};
  const shop = placement?.shop || {};
  const productId = product?.id;
  const title = getProductTitle(placement, product);
  const subtitle = getProductSubtitle(placement, product, shop);
  const image = getProductImage(placement, product) || getProductFallbackImage(product);
  const badge = normalizeText(placement?.badgeLabel) || humanizeProductBadge(product);
  const tags = buildProductTags(product);
  const price = Number(product?.price || 0);
  const originalPrice = product?.originalPrice != null ? Number(product.originalPrice) : null;
  const impressionRef = usePlacementImpressionTracker(makeProductTrackingPayload(placement, placementKey, 0));

  return (
    <div className="product-editorial" ref={impressionRef}>
      <button
        className="product-editorial-media"
        type="button"
        style={{ background: "none", padding: 0, border: 0, cursor: "pointer" }}
        onClick={() => {
          void trackPlacementClick(makeProductTrackingPayload(placement, placementKey, 0));
          if (productId && onViewProduct) onViewProduct(productId);
        }}
      >
        {image ? (
          <img src={image} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: "16px" }} />
        ) : (
          <BottleArt product={product} />
        )}
        {badge ? (
          <span className="product-editorial-badge">
            <Sparkles size={12} /> {badge}
          </span>
        ) : null}
      </button>

      <div className="product-editorial-story">
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="product-editorial-title">{title}</h2>
        <p className="product-editorial-seller">{getProductShopName(shop)}</p>
        <p className="product-editorial-desc">{subtitle}</p>

        {tags.length > 0 ? (
          <div className="product-editorial-tags">
            {tags.map((tag) => (
              <span className="product-editorial-tag" key={tag}>
                <Tag size={11} /> {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="product-editorial-footer">
          <div className="product-editorial-price">
            <strong>{formatCurrency(price)}</strong>
            {originalPrice ? <del>{formatCurrency(originalPrice)}</del> : null}
          </div>
          <button
            className="product-editorial-btn"
            type="button"
            onClick={() => {
              void trackPlacementClick(makeProductTrackingPayload(placement, placementKey, 0));
              if (productId && onViewProduct) onViewProduct(productId);
            }}
          >
            View product <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* 2 products — editorial split */
function ProductSplitCard({ placement, placementKey, index, onViewProduct }) {
  const product = placement?.product || {};
  const shop = placement?.shop || {};
  const productId = product?.id;
  const title = getProductTitle(placement, product);
  const subtitle = getProductSubtitle(placement, product, shop);
  const image = getProductImage(placement, product) || getProductFallbackImage(product);
  const badge = normalizeText(placement?.badgeLabel) || humanizeProductBadge(product);
  const tags = buildProductTags(product);
  const price = Number(product?.price || 0);
  const originalPrice = product?.originalPrice != null ? Number(product.originalPrice) : null;
  const impressionRef = usePlacementImpressionTracker(makeProductTrackingPayload(placement, placementKey, index));

  return (
    <button
      className="product-split-card"
      type="button"
      ref={impressionRef}
      onClick={() => {
        void trackPlacementClick(makeProductTrackingPayload(placement, placementKey, index));
        if (productId && onViewProduct) onViewProduct(productId);
      }}
    >
      <div className="product-split-card-media">
        {image ? (
          <img src={image} alt="" />
        ) : (
          <BottleArt product={product} />
        )}
        {badge ? (
          <span className="product-split-card-badge">
            <Sparkles size={11} /> {badge}
          </span>
        ) : null}
      </div>
      <div className="product-split-card-body">
        <h3 className="product-split-card-title">{title}</h3>
        <p className="product-split-card-seller">{getProductShopName(shop)}</p>
        {tags.length > 0 ? (
          <div className="product-split-card-tags">
            {tags.map((tag) => (
              <span className="product-split-card-tag" key={tag}>
                <Tag size={10} /> {tag}
              </span>
            ))}
          </div>
        ) : null}
        <div className="product-split-card-footer">
          <div className="product-split-card-price">
            <strong>{formatCurrency(price)}</strong>
            {originalPrice ? <del>{formatCurrency(originalPrice)}</del> : null}
          </div>
          <span className="product-split-card-link">
            View <ArrowRight size={13} />
          </span>
        </div>
      </div>
    </button>
  );
}

function ProductSplit({ placements, placementKey, eyebrow, sectionTitle, subtitle }) {
  return (
    <div className="product-split">
      <div className="product-split-heading">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{sectionTitle}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="product-split-grid">
        {placements.map((placement, index) => (
          <ProductSplitCard
            key={`split-${placement.placementKey || placementKey}-${placement.id || placement.product?.id || index}`}
            placement={placement}
            placementKey={placementKey}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

/* 3 products — one featured + two supporting (featured uses split card style but larger) */
function ProductTrio({ placements, placementKey, eyebrow, sectionTitle, subtitle, onViewProduct }) {
  const [featured, ...supporting] = placements;

  return (
    <div className="product-trio">
      <div className="product-trio-heading">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{sectionTitle}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="product-trio-grid">
        <ProductSplitCard
          placement={featured}
          placementKey={placementKey}
          index={0}
          onViewProduct={onViewProduct}
        />
        <div className="product-trio-support">
          {supporting.map((placement, index) => (
            <ProductSplitCard
              key={`trio-${placement.placementKey || placementKey}-${placement.id || placement.product?.id || index}`}
              placement={placement}
              placementKey={placementKey}
              index={index + 1}
              onViewProduct={onViewProduct}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* 4+ products — original horizontal scroll (preserved exactly) */
function ProductScrollGrid({ placements, placementKey, onViewProduct }) {
  return (
    <div className="featured-product-strip">
      <div className="featured-product-grid">
        {placements.map((placement, index) => {
          const product = placement?.product || {};
          const shop = placement?.shop || {};
          const productId = product?.id;
          const title = getProductTitle(placement, product);
          const subtitle = getProductSubtitle(placement, product, shop);
          const image = getProductImage(placement, product) || getProductFallbackImage(product);
          const badge = normalizeText(placement?.badgeLabel) || humanizeProductBadge(product);
          const tags = buildProductTags(product);
          const price = Number(product?.price || 0);
          const originalPrice = product?.originalPrice != null ? Number(product.originalPrice) : null;
          const impressionRef = usePlacementImpressionTracker(makeProductTrackingPayload(placement, placementKey, index));

          return (
            <button
              key={`scroll-${placement.placementKey || placementKey}-${placement.id || productId || index}`}
              className="featured-product-card"
              type="button"
              ref={impressionRef}
              onClick={() => {
                void trackPlacementClick(makeProductTrackingPayload(placement, placementKey, index));
                if (productId && onViewProduct) onViewProduct(productId);
              }}
            >
              <div className={image ? "featured-product-media featured-product-media--image" : "featured-product-media"}>
                {image ? (
                  <img alt="" src={image} />
                ) : (
                  <div className="featured-product-art">
                    <BottleArt product={product} />
                  </div>
                )}
                {badge ? (
                  <span className="featured-product-pill featured-product-pill--badge">
                    <Sparkles size={12} /> {badge}
                  </span>
                ) : null}
              </div>
              <div className="featured-product-copy">
                <div className="featured-product-heading">
                  <strong>{title}</strong>
                </div>
                <p>{subtitle}</p>
                <div className="featured-product-shop-line">
                  <span>{getProductShopName(shop)}</span>
                  <span>{normalizeText(product?.family) || normalizeText(product?.category) || "perfume"}</span>
                </div>
                {tags.length ? (
                  <div className="featured-product-tags">
                    {tags.map((tag) => (
                      <span className="featured-product-pill" key={tag}>
                        <Tag size={12} /> {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="featured-product-footer">
                  <div className="featured-product-price">
                    <strong>{formatCurrency(price)}</strong>
                    {originalPrice ? <del>{formatCurrency(originalPrice)}</del> : null}
                  </div>
                  <span className="featured-product-link">
                    View product <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* Main adaptive product section */
export function AdaptiveProductEdit({
  placementKey,
  eyebrow,
  sectionTitle,
  subtitle,
  sectionClassName,
  onViewProduct,
}) {
  const { data, isError } = useQuery({
    queryKey: ["homepage-featured-products", placementKey],
    queryFn: () => publicMerchandisingApi.getFeaturedProducts({ placementKey }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const products = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return data.filter((p) => p?.product?.id && p?.shop?.id);
  }, [data]);

  if (isError || products.length === 0) return null;

  if (products.length === 1) {
    return (
      <section
        className={`home-section ${sectionClassName || ""}`}
        aria-labelledby={`${placementKey}-title`}
      >
        <ProductEditorial
          placement={products[0]}
          placementKey={placementKey}
          eyebrow={eyebrow}
          onViewProduct={onViewProduct}
        />
      </section>
    );
  }

  if (products.length === 2) {
    return (
      <section
        className={`home-section ${sectionClassName || ""}`}
        aria-labelledby={`${placementKey}-title`}
      >
        <ProductSplit
          placements={products}
          placementKey={placementKey}
          eyebrow={eyebrow}
          sectionTitle={sectionTitle}
          subtitle={subtitle}
          onViewProduct={onViewProduct}
        />
      </section>
    );
  }

  if (products.length === 3) {
    return (
      <section
        className={`home-section ${sectionClassName || ""}`}
        aria-labelledby={`${placementKey}-title`}
      >
        <ProductTrio
          placements={products}
          placementKey={placementKey}
          eyebrow={eyebrow}
          sectionTitle={sectionTitle}
          subtitle={subtitle}
          onViewProduct={onViewProduct}
        />
      </section>
    );
  }

  return (
    <section
      className={`home-section featured-product-rail featured-product-rail--${placementKey.replace(/_/g, "-")} ${sectionClassName || ""}`}
      aria-labelledby={`${placementKey}-title`}
    >
      <div className="featured-product-shell--split">
        <div className="featured-product-intro">
          <span className="eyebrow">{eyebrow}</span>
          <h2 id={`${placementKey}-title`}>{sectionTitle}</h2>
          <p>{subtitle}</p>
        </div>
        <ProductScrollGrid
          placements={products}
          placementKey={placementKey}
          onViewProduct={onViewProduct}
        />
      </div>
    </section>
  );
}
