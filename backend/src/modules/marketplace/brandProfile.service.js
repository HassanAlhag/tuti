import { env } from "../../config/env.js";
import { Product } from "../../models/Product.js";
import { SellerBrandProfile } from "../../models/SellerBrandProfile.js";
import { Shop } from "../../models/Shop.js";
import { seedRepository } from "../../repositories/seedRepository.js";

const seedBrandProfiles = new Map();

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }
  return [];
}

function normalizePolicyList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item) return null;
      if (typeof item === "string") {
        const text = normalizeText(item);
        return text ? { label: "", value: text } : null;
      }
      const label = normalizeText(item.label ?? item.title ?? "");
      const text = normalizeText(item.value ?? item.text ?? item.description ?? "");
      if (!label && !text) return null;
      return { label, value: text };
    })
    .filter(Boolean);
}

function normalizeSocialLinks(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item) return null;
      if (typeof item === "string") {
        const url = normalizeText(item);
        return url ? { label: "", url } : null;
      }
      const label = normalizeText(item.label ?? item.title ?? "");
      const url = normalizeText(item.url ?? item.href ?? "");
      if (!label && !url) return null;
      return { label, url };
    })
    .filter(Boolean);
}

function normalizeMaybeTextField(payload, key) {
  return Object.prototype.hasOwnProperty.call(payload, key) ? normalizeText(payload[key]) : undefined;
}

function normalizeMaybeListField(payload, key, normalizer) {
  return Object.prototype.hasOwnProperty.call(payload, key) ? normalizer(payload[key]) : undefined;
}

function slugBase(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 60) || "seller";
}

function shopToken(shopId) {
  return normalizeText(shopId)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(-6);
}

function shopFallbackBadgeList(shop) {
  const badges = [];
  if (!shop) return badges;
  if (shop.status === "Approved") badges.push("Approved seller");
  const rating = Number(shop.serviceRating);
  if (Number.isFinite(rating) && rating > 0) badges.push(`${rating.toFixed(1)} rating`);
  const fulfillment = Number(shop.fulfillmentRate);
  if (Number.isFinite(fulfillment) && fulfillment >= 95) badges.push("High fulfillment");
  return [...new Set(badges)];
}

function normalizeBrandProfileInput(payload = {}) {
  const normalized = {};
  if (Object.prototype.hasOwnProperty.call(payload, "displayName")) normalized.displayName = normalizeText(payload.displayName);
  if (Object.prototype.hasOwnProperty.call(payload, "displayNameAr")) normalized.displayNameAr = normalizeText(payload.displayNameAr);
  if (Object.prototype.hasOwnProperty.call(payload, "shortTagline")) normalized.shortTagline = normalizeText(payload.shortTagline);
  if (Object.prototype.hasOwnProperty.call(payload, "shortTaglineAr")) normalized.shortTaglineAr = normalizeText(payload.shortTaglineAr);
  if (Object.prototype.hasOwnProperty.call(payload, "brandStory")) normalized.brandStory = normalizeText(payload.brandStory);
  if (Object.prototype.hasOwnProperty.call(payload, "brandStoryAr")) normalized.brandStoryAr = normalizeText(payload.brandStoryAr);
  if (Object.prototype.hasOwnProperty.call(payload, "logoUrl")) normalized.logoUrl = normalizeText(payload.logoUrl);
  if (Object.prototype.hasOwnProperty.call(payload, "bannerUrl")) normalized.bannerUrl = normalizeText(payload.bannerUrl);
  if (Object.prototype.hasOwnProperty.call(payload, "fragranceIdentityTags")) normalized.fragranceIdentityTags = normalizeList(payload.fragranceIdentityTags);
  if (Object.prototype.hasOwnProperty.call(payload, "specialties")) normalized.specialties = normalizeList(payload.specialties);
  if (Object.prototype.hasOwnProperty.call(payload, "trustBadges")) normalized.trustBadges = normalizeList(payload.trustBadges);
  if (Object.prototype.hasOwnProperty.call(payload, "sellerPolicies")) normalized.sellerPolicies = normalizePolicyList(payload.sellerPolicies);
  if (Object.prototype.hasOwnProperty.call(payload, "socialLinks")) normalized.socialLinks = normalizeSocialLinks(payload.socialLinks);
  if (Object.prototype.hasOwnProperty.call(payload, "published")) normalized.published = Boolean(payload.published);
  return normalized;
}

function brandProfileChecklist(profile) {
  return [
    profile.displayName,
    profile.displayNameAr,
    profile.shortTagline,
    profile.shortTaglineAr,
    profile.brandStory,
    profile.brandStoryAr,
    profile.logoUrl,
    profile.bannerUrl,
    (profile.fragranceIdentityTags || []).length > 0,
    (profile.specialties || []).length > 0,
    (profile.trustBadges || []).length > 0,
    (profile.sellerPolicies || []).length > 0,
    (profile.socialLinks || []).length > 0,
  ];
}

export function computeCompletenessScore(profile) {
  const checks = brandProfileChecklist(profile || {});
  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

async function loadShop(shopId) {
  if (!shopId) return null;
  if (env.mongoUri) {
    return Shop.findOne({ id: shopId }).lean();
  }
  return seedRepository.getShop(shopId) || null;
}

async function loadProfiles() {
  if (env.mongoUri) {
    return SellerBrandProfile.find({}).lean();
  }
  return [...seedBrandProfiles.values()].map((profile) => clone(profile));
}

async function findProfileByShopId(shopId) {
  if (!shopId) return null;
  if (env.mongoUri) {
    return SellerBrandProfile.findOne({ shopId }).lean();
  }
  return clone(seedBrandProfiles.get(shopId) || null);
}

async function findProfileBySlug(slug) {
  if (!slug) return null;
  if (env.mongoUri) {
    return SellerBrandProfile.findOne({ slug }).lean();
  }
  return clone([...seedBrandProfiles.values()].find((profile) => profile.slug === slug) || null);
}

function sanitizeStoredProfile(profile) {
  if (!profile) return null;
  return {
    id: profile._id ? String(profile._id) : normalizeText(profile.id) || null,
    shopId: profile.shopId,
    slug: profile.slug,
    displayName: normalizeText(profile.displayName),
    displayNameAr: normalizeText(profile.displayNameAr),
    shortTagline: normalizeText(profile.shortTagline),
    shortTaglineAr: normalizeText(profile.shortTaglineAr),
    brandStory: normalizeText(profile.brandStory),
    brandStoryAr: normalizeText(profile.brandStoryAr),
    logoUrl: normalizeText(profile.logoUrl),
    bannerUrl: normalizeText(profile.bannerUrl),
    fragranceIdentityTags: normalizeList(profile.fragranceIdentityTags),
    specialties: normalizeList(profile.specialties),
    trustBadges: normalizeList(profile.trustBadges),
    sellerPolicies: normalizePolicyList(profile.sellerPolicies),
    socialLinks: normalizeSocialLinks(profile.socialLinks),
    published: Boolean(profile.published),
    completenessScore: Number(profile.completenessScore || 0),
    createdAt: profile.createdAt || null,
    updatedAt: profile.updatedAt || null,
  };
}

function sanitizePublicProfile(profile) {
  if (!profile) return null;
  const stored = sanitizeStoredProfile(profile);
  return {
    slug: stored.slug,
    displayName: stored.displayName,
    displayNameAr: stored.displayNameAr,
    shortTagline: stored.shortTagline,
    shortTaglineAr: stored.shortTaglineAr,
    brandStory: stored.brandStory,
    brandStoryAr: stored.brandStoryAr,
    logoUrl: stored.logoUrl,
    bannerUrl: stored.bannerUrl,
    fragranceIdentityTags: stored.fragranceIdentityTags,
    specialties: stored.specialties,
    trustBadges: stored.trustBadges,
    sellerPolicies: stored.sellerPolicies,
    socialLinks: stored.socialLinks,
    published: stored.published,
    completenessScore: stored.completenessScore,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

async function buildDraftProfileFromShop(shop, existingProfile = null) {
  const profile = sanitizeStoredProfile(existingProfile || {});
  const displayName = profile?.displayName || normalizeText(shop?.name);
  const shopId = normalizeText(shop?.id);
  const currentSlug = profile?.slug || "";
  const fallbackSlug = await generateUniqueSlug({
    shopId,
    displayName: displayName || shopId || "seller",
    excludeShopId: shopId,
  });
  return {
    shopId,
    slug: currentSlug || fallbackSlug,
    displayName,
    displayNameAr: profile?.displayNameAr || "",
    shortTagline: profile?.shortTagline || "",
    shortTaglineAr: profile?.shortTaglineAr || "",
    brandStory: profile?.brandStory || normalizeText(shop?.story),
    brandStoryAr: profile?.brandStoryAr || "",
    logoUrl: profile?.logoUrl || normalizeText(shop?.avatar),
    bannerUrl: profile?.bannerUrl || normalizeText(shop?.cover),
    fragranceIdentityTags: profile?.fragranceIdentityTags || [],
    specialties: profile?.specialties || [],
    trustBadges: profile?.trustBadges?.length ? profile.trustBadges : shopFallbackBadgeList(shop),
    sellerPolicies: profile?.sellerPolicies || [],
    socialLinks: profile?.socialLinks || [],
    published: Boolean(profile?.published),
    completenessScore: computeCompletenessScore({
      displayName,
      displayNameAr: profile?.displayNameAr || "",
      shortTagline: profile?.shortTagline || "",
      shortTaglineAr: profile?.shortTaglineAr || "",
      brandStory: profile?.brandStory || normalizeText(shop?.story),
      brandStoryAr: profile?.brandStoryAr || "",
      logoUrl: profile?.logoUrl || normalizeText(shop?.avatar),
      bannerUrl: profile?.bannerUrl || normalizeText(shop?.cover),
      fragranceIdentityTags: profile?.fragranceIdentityTags || [],
      specialties: profile?.specialties || [],
      trustBadges: profile?.trustBadges?.length ? profile.trustBadges : shopFallbackBadgeList(shop),
      sellerPolicies: profile?.sellerPolicies || [],
      socialLinks: profile?.socialLinks || [],
    }),
    createdAt: profile?.createdAt || null,
    updatedAt: profile?.updatedAt || null,
  };
}

async function existingSlugsForShop(excludeShopId = null) {
  const profiles = await loadProfiles();
  return new Set(
    profiles
      .filter((profile) => !excludeShopId || profile.shopId !== excludeShopId)
      .map((profile) => profile.slug)
      .filter(Boolean)
  );
}

export async function generateUniqueSlug({ shopId, displayName, excludeShopId = null }) {
  const base = slugBase(displayName || shopId || "seller");
  const existing = await existingSlugsForShop(excludeShopId || null);
  const token = shopToken(shopId);
  const candidates = [base];
  if (token) candidates.push(`${base}-${token}`);
  candidates.push(`${base}-2`, `${base}-3`, `${base}-4`);

  for (const candidate of candidates) {
    if (!existing.has(candidate)) return candidate;
  }

  let suffix = 5;
  while (existing.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

async function loadShopOrThrow(shopId) {
  const shop = await loadShop(shopId);
  if (!shop) throw createHttpError(404, "Shop not found.");
  return shop;
}

async function persistProfile(profile, isNew = false) {
  if (env.mongoUri) {
    if (isNew) {
      const created = await SellerBrandProfile.create(profile);
      return created.toObject();
    }
    const updated = await SellerBrandProfile.findOneAndUpdate(
      { shopId: profile.shopId },
      profile,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    return updated;
  }

  const next = {
    ...clone(profile),
    id: profile.id || profile.shopId,
    createdAt: profile.createdAt || new Date(),
    updatedAt: new Date(),
  };
  seedBrandProfiles.set(profile.shopId, next);
  return clone(next);
}

export async function getSellerBrandProfile(shopId) {
  const shop = await loadShopOrThrow(shopId);
  const existing = await findProfileByShopId(shopId);
  return existing ? sanitizeStoredProfile(existing) : await buildDraftProfileFromShop(shop);
}

export async function previewSellerBrandProfile(shopId) {
  return getSellerBrandProfile(shopId);
}

export async function updateSellerBrandProfile(shopId, payload = {}, user = null) {
  if (user?.role === "seller" && user.shopId && user.shopId !== shopId) {
    throw createHttpError(403, "Cannot edit another seller's brand profile.");
  }

  const shop = await loadShopOrThrow(shopId);
  const existing = await findProfileByShopId(shopId);
  const normalized = normalizeBrandProfileInput(payload);
  const base = existing ? sanitizeStoredProfile(existing) : await buildDraftProfileFromShop(shop);
  const slugSource = normalized.displayName || base.displayName || shop.name || shopId;

  const next = {
    ...base,
    ...normalized,
    shopId,
    slug: existing?.slug || await generateUniqueSlug({ shopId, displayName: slugSource, excludeShopId: shopId }),
  };

  next.completenessScore = computeCompletenessScore(next);
  next.published = normalized.published == null ? Boolean(base.published) : normalized.published;

  const persisted = await persistProfile(next, !existing);
  return sanitizeStoredProfile(persisted);
}

export async function getPublicPublishedBrandProfileBySlug(slug) {
  const profile = await findProfileBySlug(slug);
  if (!profile || !profile.published) {
    throw createHttpError(404, "Seller profile not found.");
  }
  return sanitizePublicProfile(profile);
}

function sortByNewest(items) {
  return [...items].sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
}

function sanitizePublicProduct(product) {
  if (!product) return null;
  return {
    id: product.id,
    name: product.name,
    category: product.category || "perfume",
    price: Number(product.price || 0),
    originalPrice: product.originalPrice != null ? Number(product.originalPrice) : undefined,
    stock: Number(product.stock || 0),
    imagePath: product.imagePath || null,
    rating: Number(product.rating || 0),
    reviews: Number(product.reviews || 0),
    verifiedReviews: Number(product.verifiedReviews || 0),
    family: product.family || "",
    gender: product.gender || "",
    notes: Array.isArray(product.notes) ? [...product.notes] : [],
    occasionTags: Array.isArray(product.occasionTags) ? [...product.occasionTags] : [],
    releaseType: product.releaseType || "",
    collection: product.collection || "",
    color: product.color || "",
    accent: product.accent || "",
    size: product.size || "",
    description: product.description || "",
    leadTimeDays: product.leadTimeDays ?? undefined,
    customMessageAvailable: Boolean(product.customMessageAvailable),
    includes: Array.isArray(product.includes) ? [...product.includes] : [],
    bundledProductIds: Array.isArray(product.bundledProductIds) ? [...product.bundledProductIds] : [],
    flavors: Array.isArray(product.flavors) ? [...product.flavors] : [],
    allergens: Array.isArray(product.allergens) ? [...product.allergens] : [],
    createdAt: product.createdAt || null,
    updatedAt: product.updatedAt || null,
  };
}

async function loadLiveProductsForShop(shopId) {
  if (!shopId) return [];
  if (env.mongoUri) {
    return Product.find({ shopId, status: "Live" }).sort({ createdAt: -1 }).lean();
  }
  const state = seedRepository.getState();
  return sortByNewest((state.products || []).filter((product) => product.shopId === shopId && product.status === "Live"));
}

export async function getPublicSellerProductsBySlug(slug) {
  const profile = await findProfileBySlug(slug);
  if (!profile || !profile.published) {
    throw createHttpError(404, "Seller profile not found.");
  }

  const products = await loadLiveProductsForShop(profile.shopId);
  return products.map((product) => sanitizePublicProduct(product));
}

export async function listAdminSellerBrandProfiles() {
  const profiles = await loadProfiles();
  const shops = env.mongoUri
    ? await Shop.find({}).lean()
    : seedRepository.getState().shops || [];
  const shopsById = new Map(shops.map((shop) => [normalizeText(shop.id), shop]));

  return profiles
    .map((profile) => {
      const shop = shopsById.get(normalizeText(profile.shopId)) || null;
      const sanitized = sanitizeStoredProfile(profile);
      return {
        ...sanitized,
        shopName: normalizeText(shop?.name),
        shopCity: normalizeText(shop?.city),
        shopStatus: normalizeText(shop?.status),
      };
    })
    .sort((left, right) => {
      if (Boolean(left.published) !== Boolean(right.published)) return Boolean(right.published) - Boolean(left.published);
      return normalizeText(left.displayName).localeCompare(normalizeText(right.displayName));
    });
}

export function __resetBrandProfilesForTests() {
  seedBrandProfiles.clear();
}
