import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { publicMerchandisingApi } from "@tuti/shared/api/client.js";
import { trackPlacementClick, usePlacementImpressionTracker } from "../tracking/marketplaceTracking.js";

function isImageUrl(value) {
  return /^(https?:\/\/|\/uploads\/|data:)/i.test(String(value || ""));
}

function getSellerTitle(seller) {
  return seller?.displayName || seller?.shopName || "Featured seller";
}

function getSellerSubtitle(seller) {
  return seller?.shortTagline || seller?.shopCity || "UAE boutique";
}

function getSellerImage(seller, placement) {
  const image = placement?.imageUrl || seller?.bannerUrl || seller?.logoUrl || "";
  return isImageUrl(image) ? image : "";
}

function getSellerInitials(value) {
  const words = String(value || "Tuti Seller")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return words.map((word) => word[0]).join("").toUpperCase();
}

function buildSellerTags(seller) {
  const source = [
    ...(Array.isArray(seller?.fragranceIdentityTags) ? seller.fragranceIdentityTags : []),
    ...(Array.isArray(seller?.trustBadges) ? seller.trustBadges : []),
    ...(Array.isArray(seller?.specialties) ? seller.specialties : []),
  ];
  return [...new Set(source.filter(Boolean).map((t) => String(t).trim()).filter(Boolean))].slice(0, 3);
}

function makeTrackingPayload(placement, index) {
  const seller = placement.seller || {};
  return {
    placementId: placement?.id || placement?.placementId || null,
    placementType: "homepage_rail",
    placementKey: placement?.placementKey || "homepage_featured_sellers",
    sellerShopId: placement?.shopId || seller?.shopId || null,
    shopId: placement?.shopId || seller?.shopId || null,
    metadata: {
      sellerSlug: seller?.slug || "",
      cardIndex: index,
      listPosition: index + 1,
    },
  };
}

/* 0 sellers — discovery CTA */
function BoutiqueDiscovery({ onExplore }) {
  return (
    <section className="boutique-discovery" aria-labelledby="boutique-discovery-title">
      <div className="boutique-discovery-inner">
        <span className="eyebrow">Boutique makers</span>
        <h2 id="boutique-discovery-title">Meet the houses behind the gifts.</h2>
        <p>Independent fragrance houses, bakers and gifting specialists from across the UAE.</p>
        <button className="boutique-campaign-cta" type="button" onClick={onExplore}>
          Explore boutiques <ArrowRight size={15} />
        </button>
      </div>
    </section>
  );
}

/* 1 seller — brand campaign */
function BoutiqueCampaign({ placement, onViewSeller }) {
  const seller = placement.seller || {};
  const title = placement.title || getSellerTitle(seller);
  const subtitle = placement.subtitle || getSellerSubtitle(seller);
  const image = getSellerImage(seller, placement);
  const initials = getSellerInitials(title);
  const tags = buildSellerTags(seller);
  const slug = seller.slug;
  const impressionRef = usePlacementImpressionTracker(makeTrackingPayload(placement, 0));

  function handleClick() {
    void trackPlacementClick(makeTrackingPayload(placement, 0));
    if (slug && onViewSeller) onViewSeller(slug);
  }

  return (
    <section
      className="boutique-campaign"
      aria-labelledby="boutique-campaign-name"
      ref={impressionRef}
    >
      <div className="boutique-campaign-visual">
        {image ? <img src={image} alt="" /> : null}
        <span className="boutique-campaign-monogram" aria-hidden="true">{initials}</span>
        {seller.published ? (
          <span className="boutique-campaign-badge">Verified boutique</span>
        ) : null}
      </div>

      <div className="boutique-campaign-story">
        <span className="eyebrow">Boutique makers</span>
        <h2 className="boutique-campaign-name" id="boutique-campaign-name">{title}</h2>

        {seller.displayNameAr ? (
          <span className="boutique-campaign-arabic" lang="ar" dir="rtl">
            {seller.displayNameAr}
          </span>
        ) : null}

        <p className="boutique-campaign-tagline">{subtitle}</p>

        {tags.length > 0 ? (
          <div className="boutique-campaign-tags">
            {tags.map((tag) => (
              <span className="boutique-campaign-tag" key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}

        <button
          className="boutique-campaign-cta"
          type="button"
          onClick={handleClick}
        >
          Visit boutique <ArrowRight size={15} />
        </button>
      </div>
    </section>
  );
}

/* 2 sellers — balanced split */
function BoutiqueSplit({ placements, onViewSeller }) {
  return (
    <section className="boutique-split" aria-label="Featured boutiques">
      {placements.map((placement, index) => {
        const seller = placement.seller || {};
        const title = placement.title || getSellerTitle(seller);
        const subtitle = placement.subtitle || getSellerSubtitle(seller);
        const image = getSellerImage(seller, placement);
        const slug = seller.slug;
        const impressionRef = usePlacementImpressionTracker(makeTrackingPayload(placement, index));

        return (
          <button
            key={`split-${slug || index}`}
            className="boutique-split-panel"
            type="button"
            ref={impressionRef}
            onClick={() => {
              void trackPlacementClick(makeTrackingPayload(placement, index));
              if (slug && onViewSeller) onViewSeller(slug);
            }}
          >
            {image ? <img src={image} alt="" /> : null}
            <div className="boutique-split-copy">
              <h3 className="boutique-split-name">{title}</h3>
              <span className="boutique-split-tag">{subtitle}</span>
              <span className="boutique-split-link">
                Visit boutique <ArrowRight size={13} />
              </span>
            </div>
          </button>
        );
      })}
    </section>
  );
}

/* 3 sellers — one large + two supporting. Reuses campaign style for large, split for supporting. */
function BoutiqueTrio({ placements, onViewSeller }) {
  const [primary, ...supporting] = placements;

  const primarySeller = primary.seller || {};
  const primaryTitle = primary.title || getSellerTitle(primarySeller);
  const primaryImage = getSellerImage(primarySeller, primary);
  const primarySlug = primarySeller.slug;
  const primaryRef = usePlacementImpressionTracker(makeTrackingPayload(primary, 0));

  return (
    <section className="boutique-trio" aria-label="Featured boutiques">
      <button
        className="boutique-split-panel boutique-trio-primary"
        type="button"
        ref={primaryRef}
        onClick={() => {
          void trackPlacementClick(makeTrackingPayload(primary, 0));
          if (primarySlug && onViewSeller) onViewSeller(primarySlug);
        }}
      >
        {primaryImage ? <img src={primaryImage} alt="" /> : null}
        <div className="boutique-split-copy">
          <h3 className="boutique-split-name" style={{ fontSize: "clamp(2rem, 3vw, 2.8rem)" }}>
            {primaryTitle}
          </h3>
          <span className="boutique-split-tag">{primary.subtitle || getSellerSubtitle(primarySeller)}</span>
          <span className="boutique-split-link">
            Visit boutique <ArrowRight size={13} />
          </span>
        </div>
      </button>

      <div className="boutique-trio-secondary">
        {supporting.map((placement, index) => {
          const seller = placement.seller || {};
          const title = placement.title || getSellerTitle(seller);
          const slug = seller.slug;
          const image = getSellerImage(seller, placement);
          const ref = usePlacementImpressionTracker(makeTrackingPayload(placement, index + 1));

          return (
            <button
              key={`trio-${slug || index}`}
              className="boutique-split-panel"
              type="button"
              ref={ref}
              onClick={() => {
                void trackPlacementClick(makeTrackingPayload(placement, index + 1));
                if (slug && onViewSeller) onViewSeller(slug);
              }}
            >
              {image ? <img src={image} alt="" /> : null}
              <div className="boutique-split-copy">
                <h3 className="boutique-split-name" style={{ fontSize: "clamp(1.4rem, 2vw, 1.8rem)" }}>
                  {title}
                </h3>
                <span className="boutique-split-tag">{placement.subtitle || getSellerSubtitle(seller)}</span>
                <span className="boutique-split-link">
                  Visit <ArrowRight size={12} />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* 4+ sellers — horizontal scroll gallery (from original FeaturedSellerRail) */
function SellerGalleryCard({ placement, index, onViewSeller }) {
  const seller = placement.seller || {};
  const title = placement.title || getSellerTitle(seller);
  const subtitle = placement.subtitle || getSellerSubtitle(seller);
  const image = getSellerImage(seller, placement);
  const initials = getSellerInitials(title);
  const tags = buildSellerTags(seller);
  const slug = seller.slug;
  const impressionRef = usePlacementImpressionTracker(makeTrackingPayload(placement, index));

  return (
    <button
      className="featured-seller-card"
      type="button"
      ref={impressionRef}
      onClick={() => {
        void trackPlacementClick(makeTrackingPayload(placement, index));
        if (slug && onViewSeller) onViewSeller(slug);
      }}
    >
      <div className={image ? "featured-seller-media featured-seller-media--image" : "featured-seller-media featured-seller-media--abstract"}>
        {image ? <img alt="" src={image} /> : null}
        <span className="featured-seller-watermark" aria-hidden="true">{initials}</span>
        {seller.published ? <span className="featured-seller-badge">Verified boutique</span> : null}
        <span className="featured-seller-mark" aria-hidden="true">{initials}</span>
      </div>
      <div className="featured-seller-copy">
        <div className="featured-seller-heading">
          <strong>{title}</strong>
        </div>
        {seller.displayNameAr ? (
          <small lang="ar" dir="auto">{seller.displayNameAr}</small>
        ) : null}
        <p>{subtitle}</p>
        {tags.length ? (
          <div className="featured-seller-tags">
            {tags.map((tag) => (
              <span className="featured-seller-pill" key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}
        <span className="featured-seller-link">
          Visit boutique <ArrowRight size={14} />
        </span>
      </div>
    </button>
  );
}

function BoutiqueGallery({ placements, onViewSeller }) {
  return (
    <section className="featured-seller-rail" aria-labelledby="boutique-gallery-title">
      <div className="featured-seller-shell">
        <div className="featured-seller-intro">
          <span className="eyebrow">Boutique makers</span>
          <h2 id="boutique-gallery-title">Meet the houses behind the gifts.</h2>
          <p>Independent fragrance houses, bakers and gifting specialists from across the UAE.</p>
        </div>
        <div className="featured-seller-gallery">
          <div className="featured-seller-grid">
            {placements.map((placement, index) => (
              <SellerGalleryCard
                key={`gallery-${placement.seller?.slug || index}`}
                placement={placement}
                index={index}
                onViewSeller={onViewSeller}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* Main adaptive component */
export function AdaptiveBoutique({ onViewSeller, onExploreShops }) {
  const { data, isError } = useQuery({
    queryKey: ["homepage-featured-sellers"],
    queryFn: () => publicMerchandisingApi.getFeaturedSellers({ placementKey: "homepage_featured_sellers" }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const sellers = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return data
      .filter((p) => p?.seller?.slug)
      .map((p) => ({ ...p, seller: p.seller || {} }));
  }, [data]);

  if (isError) return null;

  if (sellers.length === 0) {
    return <BoutiqueDiscovery onExplore={onExploreShops} />;
  }

  if (sellers.length === 1) {
    return <BoutiqueCampaign placement={sellers[0]} onViewSeller={onViewSeller} />;
  }

  if (sellers.length === 2) {
    return <BoutiqueSplit placements={sellers} onViewSeller={onViewSeller} />;
  }

  if (sellers.length === 3) {
    return <BoutiqueTrio placements={sellers} onViewSeller={onViewSeller} />;
  }

  return <BoutiqueGallery placements={sellers} onViewSeller={onViewSeller} />;
}
