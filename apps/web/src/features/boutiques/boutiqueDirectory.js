import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { publicMerchandisingApi } from "@tuti/shared/api/client.js";
import perfumeCategoryImage from "../../assets/category-perfumes.jpg";
import cakeCategoryImage from "../../assets/category-cakes.jpg";
import giftSetCategoryImage from "../../assets/category-gift-sets.jpg";

// Tuti never combines products from multiple boutiques into one physical
// box -- every category label below describes what a single boutique
// prepares itself, never a cross-boutique bundle claim.
const CATEGORY_META = {
  perfume: {
    label: "Perfumes",
    copy: "Curated fragrances, oud, and scent edits prepared by the boutique.",
    image: perfumeCategoryImage,
  },
  cake: {
    label: "Cakes & Desserts",
    copy: "Celebration cakes and desserts prepared with boutique-level care.",
    image: cakeCategoryImage,
  },
  dessert: {
    label: "Cakes & Desserts",
    copy: "Celebration cakes and desserts prepared with boutique-level care.",
    image: cakeCategoryImage,
  },
  gift_box: {
    label: "Gift Boxes",
    copy: "Ready-made Gift Boxes and occasion gifts, prepared and wrapped by the boutique.",
    image: giftSetCategoryImage,
  },
  bundle: {
    label: "Gift Boxes",
    copy: "Ready-made Gift Boxes and occasion gifts, prepared and wrapped by the boutique.",
    image: giftSetCategoryImage,
  },
};

const NEUTRAL_META = {
  label: "Boutique",
  copy: "Boutique products prepared and packaged with care for every occasion.",
  // No dedicated neutral/mixed-category editorial photo exists yet in the
  // asset library -- see docs/seller-image-brief.md for the requested shot.
  // The card falls back to a tinted monogram treatment instead of forcing
  // a mismatched category photo onto a multi-category boutique.
  image: "",
};

export function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

export function getShopCategories(shop = {}) {
  if (Array.isArray(shop.categories) && shop.categories.length) return shop.categories;
  if (shop.category && shop.category !== "mixed") return [shop.category];
  return [];
}

// "mixed" (multi-category) and "no category data" both fall back to the
// neutral treatment per the seller-image fallback mapping -- only a single
// clear category gets its own editorial fallback photo.
export function getPrimaryCategory(shop = {}) {
  if (shop.category && shop.category !== "mixed") return shop.category;
  return "";
}

export function getCategoryMeta(category) {
  return CATEGORY_META[category] || NEUTRAL_META;
}

export function getBoutiqueFallbackImage(shop) {
  return getCategoryMeta(getPrimaryCategory(shop)).image;
}

export function getBoutiqueFallbackCopy(shop) {
  return getCategoryMeta(getPrimaryCategory(shop)).copy;
}

export function getBoutiqueCategoryChips(shop, limit = 3) {
  return getShopCategories(shop)
    .map((category) => CATEGORY_META[category]?.label || NEUTRAL_META.label)
    .filter((label, index, all) => all.indexOf(label) === index)
    .slice(0, limit);
}

export function getBoutiqueTitle(shop = {}) {
  return shop.displayName || shop.name || "Verified boutique";
}

export function getBoutiqueInitials(value) {
  return String(value || "Tuti Boutique")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

const DELIVERY_LABELS = {
  seller_delivery: "Delivered by the boutique",
  platform_delivery: "Delivered by Tuti drivers",
  pickup: "Pickup available",
};

export function getBoutiqueDeliveryLabel(shop = {}) {
  return DELIVERY_LABELS[shop.deliveryModel] || "";
}

function isRealImageUrl(value) {
  return /^(https?:\/\/|\/uploads\/|data:)/i.test(String(value || ""));
}

/**
 * storefront.shops (marketplaceApi.getStorefront) never carries a public
 * brand `slug` -- only the seller-brand-profile records do, and the only
 * public read of those is the featured-sellers placement list. This hook
 * merges the two client-side (by normalized display name, the one field
 * both shapes reliably share) so every card can link to the real
 * /sellers/:slug profile instead of a raw shop id that the profile API
 * doesn't recognise.
 */
export function useEnrichedBoutiques(shops = []) {
  const { data, isLoading } = useQuery({
    queryKey: ["boutique-directory-brand-profiles"],
    queryFn: () => publicMerchandisingApi.getFeaturedSellers({}),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const brandByName = useMemo(() => {
    const map = new Map();
    (Array.isArray(data) ? data : []).forEach((placement) => {
      const seller = placement?.seller;
      if (!seller?.displayName) return;
      map.set(normalizeKey(seller.displayName), {
        slug: seller.slug || "",
        tagline: seller.shortTagline || "",
        image: isRealImageUrl(seller.bannerUrl)
          ? seller.bannerUrl
          : isRealImageUrl(seller.logoUrl) ? seller.logoUrl : "",
        tags: [
          ...(Array.isArray(seller.fragranceIdentityTags) ? seller.fragranceIdentityTags : []),
          ...(Array.isArray(seller.specialties) ? seller.specialties : []),
        ].filter(Boolean),
        published: Boolean(seller.published),
      });
    });
    return map;
  }, [data]);

  const boutiques = useMemo(() => shops.map((shop) => {
    const brand = brandByName.get(normalizeKey(shop.name)) || null;
    return {
      ...shop,
      slug: brand?.slug || "",
      title: getBoutiqueTitle(shop),
      tagline: brand?.tagline || "",
      description: brand?.tagline || getBoutiqueFallbackCopy(shop),
      image: brand?.image || "",
      fallbackImage: getBoutiqueFallbackImage(shop),
      categoryChips: getBoutiqueCategoryChips(shop),
      rating: shop.serviceRating || null,
      location: shop.city || "",
      deliveryLabel: getBoutiqueDeliveryLabel(shop),
      verified: shop.status === "Approved",
      tags: brand?.tags || [],
    };
  }), [shops, brandByName]);

  return { boutiques, isLoading };
}
