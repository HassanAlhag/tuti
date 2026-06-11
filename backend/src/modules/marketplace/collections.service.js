import { randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env.js";
import { CuratedCollection } from "../../models/CuratedCollection.js";
import { Product } from "../../models/Product.js";
import { Shop } from "../../models/Shop.js";
import { seedRepository } from "../../repositories/seedRepository.js";
import { getSellerBrandProfile } from "./brandProfile.service.js";

const seedCuratedCollections = new Map();

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

function normalizePlacementKey(value) {
  return normalizeText(value);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback = true) {
  if (value == null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = normalizeText(value).toLowerCase();
  if (["false", "0", "off", "no", "inactive"].includes(normalized)) return false;
  if (["true", "1", "on", "yes", "active"].includes(normalized)) return true;
  return Boolean(value);
}

function normalizeDate(value) {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function slugBase(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 70) || "collection";
}

function slugToken(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(-6);
}

function compareTopLevelCollections(left, right) {
  if (Boolean(left.active) !== Boolean(right.active)) return Boolean(right.active) - Boolean(left.active);
  if (Boolean(left.published) !== Boolean(right.published)) return Boolean(right.published) - Boolean(left.published);
  if (left.priority !== right.priority) return right.priority - left.priority;
  return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
}

function compareItems(left, right) {
  if (left.priority !== right.priority) return right.priority - left.priority;
  return (left.__order || 0) - (right.__order || 0);
}

function isDateWindowActive(collection, now = new Date()) {
  if (!collection?.active || !collection?.published) return false;
  const current = now instanceof Date ? now : new Date(now);
  const startsAt = normalizeDate(collection.startsAt);
  const endsAt = normalizeDate(collection.endsAt);
  if (startsAt && current < startsAt) return false;
  if (endsAt && current > endsAt) return false;
  return true;
}

function normalizeCollectionItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    type: normalizeText(item?.type) === "seller" ? "seller" : "product",
    productId: normalizeText(item?.productId),
    shopId: normalizeText(item?.shopId),
    brandProfileId: normalizeText(item?.brandProfileId),
    titleOverride: normalizeText(item?.titleOverride),
    subtitleOverride: normalizeText(item?.subtitleOverride),
    imageOverrideUrl: normalizeText(item?.imageOverrideUrl),
    badgeLabel: normalizeText(item?.badgeLabel),
    priority: toNumber(item?.priority, 0),
  }));
}

function normalizeCollectionInput(payload = {}) {
  return {
    title: normalizeText(payload.title),
    titleAr: normalizeText(payload.titleAr),
    subtitle: normalizeText(payload.subtitle),
    subtitleAr: normalizeText(payload.subtitleAr),
    description: normalizeText(payload.description),
    descriptionAr: normalizeText(payload.descriptionAr),
    bannerUrl: normalizeText(payload.bannerUrl),
    mobileBannerUrl: normalizeText(payload.mobileBannerUrl),
    placementKey: normalizePlacementKey(payload.placementKey),
    theme: normalizeText(payload.theme),
    priority: toNumber(payload.priority, 0),
    startsAt: normalizeDate(payload.startsAt),
    endsAt: normalizeDate(payload.endsAt),
    active: toBoolean(payload.active, true),
    published: payload.published == null ? undefined : toBoolean(payload.published, false),
    items: Object.prototype.hasOwnProperty.call(payload, "items") ? normalizeCollectionItems(payload.items) : undefined,
  };
}

function assertAdminActor(actor) {
  if (!actor || actor.role !== "admin") {
    throw createHttpError(403, "Admin permissions required.");
  }
}

function validateDateWindow(startsAt, endsAt) {
  if (startsAt && endsAt && startsAt > endsAt) {
    throw createHttpError(400, "startsAt must be before endsAt.");
  }
}

function normalizeProductVisibilityProduct(product) {
  if (!product) return null;
  return {
    id: normalizeText(product.id),
    name: normalizeText(product.name),
    category: normalizeText(product.category) || "perfume",
    price: Number(product.price || 0),
    originalPrice: product.originalPrice != null ? Number(product.originalPrice) : undefined,
    stock: Number(product.stock || 0),
    status: normalizeText(product.status) || "Live",
    imagePath: product.imagePath || null,
    rating: Number(product.rating || 0),
    reviews: Number(product.reviews || 0),
    verifiedReviews: Number(product.verifiedReviews || 0),
    family: normalizeText(product.family),
    gender: normalizeText(product.gender),
    notes: Array.isArray(product.notes) ? [...product.notes] : [],
    occasionTags: Array.isArray(product.occasionTags) ? [...product.occasionTags] : [],
    releaseType: normalizeText(product.releaseType),
    collection: normalizeText(product.collection),
    color: normalizeText(product.color) || "#52796f",
    accent: normalizeText(product.accent) || "#e9c46a",
    size: normalizeText(product.size),
    description: normalizeText(product.description),
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

function normalizeProductShop(shop) {
  if (!shop) return null;
  return {
    id: normalizeText(shop.id),
    name: normalizeText(shop.name),
    city: normalizeText(shop.city),
    avatar: normalizeText(shop.avatar),
    status: normalizeText(shop.status),
  };
}

function normalizePublicSellerProfile(profile) {
  if (!profile) return null;
  return {
    slug: normalizeText(profile.slug),
    displayName: normalizeText(profile.displayName),
    displayNameAr: normalizeText(profile.displayNameAr),
    shortTagline: normalizeText(profile.shortTagline),
    shortTaglineAr: normalizeText(profile.shortTaglineAr),
    brandStory: normalizeText(profile.brandStory),
    brandStoryAr: normalizeText(profile.brandStoryAr),
    logoUrl: normalizeText(profile.logoUrl),
    bannerUrl: normalizeText(profile.bannerUrl),
    fragranceIdentityTags: Array.isArray(profile.fragranceIdentityTags) ? [...profile.fragranceIdentityTags] : [],
    specialties: Array.isArray(profile.specialties) ? [...profile.specialties] : [],
    trustBadges: Array.isArray(profile.trustBadges) ? [...profile.trustBadges] : [],
    sellerPolicies: Array.isArray(profile.sellerPolicies)
      ? profile.sellerPolicies.map((item) => item && typeof item === "object"
        ? { label: normalizeText(item.label), value: normalizeText(item.value) }
        : { label: "", value: normalizeText(item) })
      : [],
    socialLinks: Array.isArray(profile.socialLinks)
      ? profile.socialLinks.map((item) => item && typeof item === "object"
        ? { label: normalizeText(item.label), url: normalizeText(item.url) }
        : { label: "", url: normalizeText(item) })
      : [],
    published: Boolean(profile.published),
    completenessScore: toNumber(profile.completenessScore, 0),
  };
}

function normalizeAdminSellerProfile(profile) {
  if (!profile) return null;
  return {
    id: normalizeText(profile.id),
    ...normalizePublicSellerProfile(profile),
  };
}

function getSeedCollectionState() {
  const state = seedRepository.getState();
  if (!Array.isArray(state.curatedCollections)) state.curatedCollections = [];
  return state.curatedCollections;
}

async function loadCollections() {
  if (env.mongoUri) {
    return CuratedCollection.find({}).lean();
  }
  return [...getSeedCollectionState()].map((item) => clone(item));
}

async function findCollectionById(id) {
  if (!id) return null;
  if (env.mongoUri) {
    return CuratedCollection.findById(id).lean();
  }
  return clone(getSeedCollectionState().find((item) => String(item.id) === String(id)) || null);
}

async function findCollectionBySlug(slug) {
  const normalizedSlug = normalizeText(slug);
  if (!normalizedSlug) return null;
  if (env.mongoUri) {
    return CuratedCollection.findOne({ slug: normalizedSlug }).lean();
  }
  return clone(getSeedCollectionState().find((item) => normalizeText(item.slug) === normalizedSlug) || null);
}

async function existingSlugs(excludeId = null) {
  const collections = await loadCollections();
  return new Set(
    collections
      .filter((item) => !excludeId || String(item.id || item._id || "") !== String(excludeId))
      .map((item) => normalizeText(item.slug))
      .filter(Boolean)
  );
}

async function generateUniqueSlug({ title, excludeId = null }) {
  const base = slugBase(title);
  const token = slugToken(title);
  const existing = await existingSlugs(excludeId);
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

function sanitizeStoredCollection(collection) {
  if (!collection) return null;
  return {
    id: collection._id ? String(collection._id) : normalizeText(collection.id) || null,
    slug: normalizeText(collection.slug),
    title: normalizeText(collection.title),
    titleAr: normalizeText(collection.titleAr),
    subtitle: normalizeText(collection.subtitle),
    subtitleAr: normalizeText(collection.subtitleAr),
    description: normalizeText(collection.description),
    descriptionAr: normalizeText(collection.descriptionAr),
    bannerUrl: normalizeText(collection.bannerUrl),
    mobileBannerUrl: normalizeText(collection.mobileBannerUrl),
    placementKey: normalizeText(collection.placementKey),
    theme: normalizeText(collection.theme),
    priority: toNumber(collection.priority, 0),
    startsAt: normalizeDate(collection.startsAt),
    endsAt: normalizeDate(collection.endsAt),
    active: Boolean(collection.active),
    published: Boolean(collection.published),
    items: Array.isArray(collection.items)
      ? collection.items.map((item) => ({
        type: normalizeText(item.type) === "seller" ? "seller" : "product",
        productId: normalizeText(item.productId),
        shopId: normalizeText(item.shopId),
        brandProfileId: normalizeText(item.brandProfileId),
        titleOverride: normalizeText(item.titleOverride),
        subtitleOverride: normalizeText(item.subtitleOverride),
        imageOverrideUrl: normalizeText(item.imageOverrideUrl),
        badgeLabel: normalizeText(item.badgeLabel),
        priority: toNumber(item.priority, 0),
      }))
      : [],
    createdBy: normalizeText(collection.createdBy),
    updatedBy: normalizeText(collection.updatedBy),
    createdAt: collection.createdAt || null,
    updatedAt: collection.updatedAt || null,
  };
}

function safeAdminProduct(product) {
  if (!product) return null;
  return {
    id: normalizeText(product.id),
    name: normalizeText(product.name),
    category: normalizeText(product.category) || "perfume",
    price: Number(product.price || 0),
    originalPrice: product.originalPrice != null ? Number(product.originalPrice) : undefined,
    stock: Number(product.stock || 0),
    status: normalizeText(product.status) || "Live",
    imagePath: product.imagePath || null,
    family: normalizeText(product.family),
    gender: normalizeText(product.gender),
    releaseType: normalizeText(product.releaseType),
    collection: normalizeText(product.collection),
    size: normalizeText(product.size),
    rating: Number(product.rating || 0),
    reviews: Number(product.reviews || 0),
    verifiedReviews: Number(product.verifiedReviews || 0),
    shopId: normalizeText(product.shopId),
  };
}

function safePublicProduct(product) {
  if (!product) return null;
  return {
    id: normalizeText(product.id),
    name: normalizeText(product.name),
    category: normalizeText(product.category) || "perfume",
    price: Number(product.price || 0),
    originalPrice: product.originalPrice != null ? Number(product.originalPrice) : undefined,
    stock: Number(product.stock || 0),
    status: normalizeText(product.status) || "Live",
    imagePath: product.imagePath || null,
    rating: Number(product.rating || 0),
    reviews: Number(product.reviews || 0),
    verifiedReviews: Number(product.verifiedReviews || 0),
    family: normalizeText(product.family),
    gender: normalizeText(product.gender),
    notes: Array.isArray(product.notes) ? [...product.notes] : [],
    occasionTags: Array.isArray(product.occasionTags) ? [...product.occasionTags] : [],
    releaseType: normalizeText(product.releaseType),
    collection: normalizeText(product.collection),
    color: normalizeText(product.color) || "#52796f",
    accent: normalizeText(product.accent) || "#e9c46a",
    size: normalizeText(product.size),
    description: normalizeText(product.description),
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

function safeAdminShop(shop) {
  if (!shop) return null;
  return {
    id: normalizeText(shop.id),
    name: normalizeText(shop.name),
    city: normalizeText(shop.city),
    avatar: normalizeText(shop.avatar),
    status: normalizeText(shop.status),
    deliveryModel: normalizeText(shop.deliveryModel),
  };
}

function safePublicShop(shop) {
  if (!shop) return null;
  return {
    name: normalizeText(shop.name),
    city: normalizeText(shop.city),
    avatar: normalizeText(shop.avatar),
  };
}

function safeAdminSeller(profile) {
  if (!profile) return null;
  return {
    id: normalizeText(profile.id),
    slug: normalizeText(profile.slug),
    displayName: normalizeText(profile.displayName),
    displayNameAr: normalizeText(profile.displayNameAr),
    shortTagline: normalizeText(profile.shortTagline),
    shortTaglineAr: normalizeText(profile.shortTaglineAr),
    brandStory: normalizeText(profile.brandStory),
    brandStoryAr: normalizeText(profile.brandStoryAr),
    logoUrl: normalizeText(profile.logoUrl),
    bannerUrl: normalizeText(profile.bannerUrl),
    fragranceIdentityTags: Array.isArray(profile.fragranceIdentityTags) ? [...profile.fragranceIdentityTags] : [],
    specialties: Array.isArray(profile.specialties) ? [...profile.specialties] : [],
    trustBadges: Array.isArray(profile.trustBadges) ? [...profile.trustBadges] : [],
    sellerPolicies: Array.isArray(profile.sellerPolicies)
      ? profile.sellerPolicies.map((item) => item && typeof item === "object"
        ? { label: normalizeText(item.label), value: normalizeText(item.value) }
        : { label: "", value: normalizeText(item) })
      : [],
    socialLinks: Array.isArray(profile.socialLinks)
      ? profile.socialLinks.map((item) => item && typeof item === "object"
        ? { label: normalizeText(item.label), url: normalizeText(item.url) }
        : { label: "", url: normalizeText(item) })
      : [],
    published: Boolean(profile.published),
    completenessScore: toNumber(profile.completenessScore, 0),
  };
}

function safePublicSeller(profile) {
  if (!profile) return null;
  return {
    slug: normalizeText(profile.slug),
    displayName: normalizeText(profile.displayName),
    displayNameAr: normalizeText(profile.displayNameAr),
    shortTagline: normalizeText(profile.shortTagline),
    shortTaglineAr: normalizeText(profile.shortTaglineAr),
    brandStory: normalizeText(profile.brandStory),
    brandStoryAr: normalizeText(profile.brandStoryAr),
    logoUrl: normalizeText(profile.logoUrl),
    bannerUrl: normalizeText(profile.bannerUrl),
    fragranceIdentityTags: Array.isArray(profile.fragranceIdentityTags) ? [...profile.fragranceIdentityTags] : [],
    specialties: Array.isArray(profile.specialties) ? [...profile.specialties] : [],
    trustBadges: Array.isArray(profile.trustBadges) ? [...profile.trustBadges] : [],
    sellerPolicies: Array.isArray(profile.sellerPolicies)
      ? profile.sellerPolicies.map((item) => item && typeof item === "object"
        ? { label: normalizeText(item.label), value: normalizeText(item.value) }
        : { label: "", value: normalizeText(item) })
      : [],
    socialLinks: Array.isArray(profile.socialLinks)
      ? profile.socialLinks.map((item) => item && typeof item === "object"
        ? { label: normalizeText(item.label), url: normalizeText(item.url) }
        : { label: "", url: normalizeText(item) })
      : [],
    published: Boolean(profile.published),
    completenessScore: toNumber(profile.completenessScore, 0),
  };
}

async function loadProductAndShop(productId, shopId) {
  if (!productId || !shopId) return { product: null, shop: null };
  if (env.mongoUri) {
    const [product, shop] = await Promise.all([
      Product.findOne({ id: productId }).lean(),
      Shop.findOne({ id: shopId }).lean(),
    ]);
    return { product, shop };
  }
  const state = seedRepository.getState();
  return {
    product: clone((state.products || []).find((item) => normalizeText(item.id) === normalizeText(productId)) || null),
    shop: clone((state.shops || []).find((item) => normalizeText(item.id) === normalizeText(shopId)) || null),
  };
}

async function resolveCollectionItemRefs(item) {
  if (item.type === "product") {
    const { product, shop } = await loadProductAndShop(item.productId, item.shopId);
    return { product, shop, seller: null };
  }
  const profile = await getSellerBrandProfile(item.shopId);
  return { product: null, shop: null, seller: profile };
}

async function validateCollectionItemsForAdmin(items) {
  for (const item of items) {
    if (item.type === "product") {
      if (!item.productId || !item.shopId) {
        throw createHttpError(400, "Product collection items require productId and shopId.");
      }
      const { product, shop } = await loadProductAndShop(item.productId, item.shopId);
      if (!product) throw createHttpError(404, "Product not found.");
      if (!shop) throw createHttpError(404, "Shop not found.");
      if (normalizeText(product.shopId) !== normalizeText(shop.id)) {
        throw createHttpError(400, "The collection product must belong to the linked shop.");
      }
    } else if (item.type === "seller") {
      if (!item.shopId || !item.brandProfileId) {
        throw createHttpError(400, "Seller collection items require shopId and brandProfileId.");
      }
      const profile = await getSellerBrandProfile(item.shopId);
      if (!profile?.id) {
        throw createHttpError(404, "Seller brand profile not found.");
      }
      if (normalizeText(profile.id) !== normalizeText(item.brandProfileId)) {
        throw createHttpError(400, "The collection seller item must reference the linked brand profile.");
      }
    } else {
      throw createHttpError(400, "Invalid collection item type.");
    }
  }
}

function normalizeCollectionAdminRecord(collection) {
  const stored = sanitizeStoredCollection(collection);
  return {
    ...stored,
    items: Array.isArray(stored.items) ? [...stored.items] : [],
  };
}

async function buildCollectionAdminItem(item) {
  const refs = await resolveCollectionItemRefs(item);
  if (item.type === "product") {
    const { product, shop } = refs;
    return {
      type: "product",
      productId: item.productId,
      shopId: item.shopId,
      brandProfileId: "",
      titleOverride: item.titleOverride,
      subtitleOverride: item.subtitleOverride,
      imageOverrideUrl: item.imageOverrideUrl,
      badgeLabel: item.badgeLabel,
      priority: item.priority,
      title: item.titleOverride || normalizeText(product?.name) || "Featured product",
      subtitle: item.subtitleOverride || normalizeText(product?.family) || normalizeText(product?.collection) || "",
      imageUrl: item.imageOverrideUrl || normalizeText(product?.imagePath) || "",
      badge: item.badgeLabel || normalizeText(product?.releaseType) || "",
      product: safeAdminProduct(product),
      shop: safeAdminShop(shop),
      seller: null,
    };
  }

  const seller = refs.seller;
  return {
    type: "seller",
    productId: "",
    shopId: item.shopId,
    brandProfileId: item.brandProfileId,
    titleOverride: item.titleOverride,
    subtitleOverride: item.subtitleOverride,
    imageOverrideUrl: item.imageOverrideUrl,
    badgeLabel: item.badgeLabel,
    priority: item.priority,
    title: item.titleOverride || normalizeText(seller?.displayName) || "Featured seller",
    subtitle: item.subtitleOverride || normalizeText(seller?.shortTagline) || "",
    imageUrl: item.imageOverrideUrl || normalizeText(seller?.bannerUrl) || normalizeText(seller?.logoUrl) || "",
    badge: item.badgeLabel || (seller?.published ? "Published" : "Draft"),
    product: null,
    shop: null,
    seller: safeAdminSeller(seller),
  };
}

async function buildCollectionPublicItem(item) {
  const refs = await resolveCollectionItemRefs(item);
  if (item.type === "product") {
    const { product, shop } = refs;
    if (!product || !shop) return null;
    if (normalizeText(product.status) !== "Live") return null;
    if (normalizeText(shop.status) !== "Approved") return null;
    return {
      type: "product",
      priority: item.priority,
      title: item.titleOverride || normalizeText(product.name) || "Featured product",
      subtitle: item.subtitleOverride
        || normalizeText(product.family)
        || normalizeText(product.collection)
        || normalizeText(product.description)
        || "",
      imageUrl: item.imageOverrideUrl || normalizeText(product.imagePath) || "",
      badgeLabel: item.badgeLabel || normalizeText(product.releaseType) || "",
      product: safePublicProduct(product),
      shop: safePublicShop(shop),
      seller: null,
    };
  }

  const seller = refs.seller;
  if (!seller?.published) return null;
  return {
    type: "seller",
    priority: item.priority,
    title: item.titleOverride || normalizeText(seller.displayName) || "Featured seller",
    subtitle: item.subtitleOverride || normalizeText(seller.shortTagline) || "",
    imageUrl: item.imageOverrideUrl || normalizeText(seller.bannerUrl) || normalizeText(seller.logoUrl) || "",
    badgeLabel: item.badgeLabel || (seller.trustBadges?.[0] || "Published seller"),
    product: null,
    shop: null,
    seller: safePublicSeller(seller),
  };
}

function sortCollectionItems(items) {
  return [...items]
    .map((item, index) => ({ ...item, __order: index }))
    .sort(compareItems)
    .map(({ __order, ...item }) => item);
}

async function persistCollection(collection, isNew = false) {
  if (env.mongoUri) {
    if (isNew) {
      const created = await CuratedCollection.create(collection);
      return created.toObject();
    }
    const updated = await CuratedCollection.findByIdAndUpdate(
      collection.id || collection._id,
      collection,
      { new: true }
    ).lean();
    return updated;
  }

  const state = getSeedCollectionState();
  const next = {
    ...clone(collection),
    id: collection.id || randomUUID(),
    createdAt: collection.createdAt || new Date(),
    updatedAt: new Date(),
  };
  const index = state.findIndex((item) => String(item.id) === String(next.id));
  if (index >= 0) {
    state[index] = next;
  } else {
    state.unshift(next);
  }
  return clone(next);
}

export const collectionItemSchema = z.object({
  type: z.enum(["product", "seller"]),
  productId: z.string().trim().optional(),
  shopId: z.string().trim().optional(),
  brandProfileId: z.string().trim().optional(),
  titleOverride: z.string().trim().optional(),
  subtitleOverride: z.string().trim().optional(),
  imageOverrideUrl: z.string().trim().optional(),
  badgeLabel: z.string().trim().optional(),
  priority: z.union([z.number(), z.string()]).optional(),
});

export const curatedCollectionCreateSchema = z.object({
  title: z.string().trim().min(1),
  titleAr: z.string().trim().optional(),
  subtitle: z.string().trim().optional(),
  subtitleAr: z.string().trim().optional(),
  description: z.string().trim().optional(),
  descriptionAr: z.string().trim().optional(),
  bannerUrl: z.string().trim().optional(),
  mobileBannerUrl: z.string().trim().optional(),
  placementKey: z.string().trim().optional(),
  theme: z.string().trim().optional(),
  priority: z.union([z.number(), z.string()]).optional(),
  startsAt: z.union([z.string(), z.date()]).optional().nullable(),
  endsAt: z.union([z.string(), z.date()]).optional().nullable(),
  active: z.union([z.boolean(), z.string()]).optional(),
  published: z.union([z.boolean(), z.string()]).optional(),
  items: z.array(collectionItemSchema).optional(),
});

export const curatedCollectionUpdateSchema = z.object({
  title: z.string().trim().optional(),
  titleAr: z.string().trim().optional(),
  subtitle: z.string().trim().optional(),
  subtitleAr: z.string().trim().optional(),
  description: z.string().trim().optional(),
  descriptionAr: z.string().trim().optional(),
  bannerUrl: z.string().trim().optional(),
  mobileBannerUrl: z.string().trim().optional(),
  placementKey: z.string().trim().optional(),
  theme: z.string().trim().optional(),
  priority: z.union([z.number(), z.string()]).optional(),
  startsAt: z.union([z.string(), z.date()]).optional().nullable(),
  endsAt: z.union([z.string(), z.date()]).optional().nullable(),
  active: z.union([z.boolean(), z.string()]).optional(),
  published: z.union([z.boolean(), z.string()]).optional(),
  items: z.array(collectionItemSchema).optional(),
});

export async function listAdminCollections(filters = {}) {
  const { placementKey, active, published } = filters || {};
  const collections = await loadCollections();
  const filtered = collections.filter((collection) => {
    if (placementKey && normalizePlacementKey(collection.placementKey) !== normalizePlacementKey(placementKey)) return false;
    if (active != null && String(Boolean(collection.active)) !== String(active === true || active === "true")) return false;
    if (published != null && String(Boolean(collection.published)) !== String(published === true || published === "true")) return false;
    return true;
  });

  const hydrated = await Promise.all(
    filtered
      .sort(compareTopLevelCollections)
      .map(async (collection) => {
        const stored = sanitizeStoredCollection(collection);
        const items = sortCollectionItems(stored.items || []);
        const resolvedItems = [];
        for (const item of items) {
          resolvedItems.push(await buildCollectionAdminItem(item));
        }
        return {
          ...normalizeCollectionAdminRecord(collection),
          items: resolvedItems,
        };
      })
  );

  return hydrated;
}

export async function getAdminCollection(id) {
  const collection = await findCollectionById(id);
  if (!collection) {
    throw createHttpError(404, "Curated collection not found.");
  }
  const stored = sanitizeStoredCollection(collection);
  const items = sortCollectionItems(stored.items || []);
  const resolvedItems = [];
  for (const item of items) {
    resolvedItems.push(await buildCollectionAdminItem(item));
  }
  return {
    ...normalizeCollectionAdminRecord(collection),
    items: resolvedItems,
  };
}

async function ensureUniqueSlugForCreate(title, excludeId = null) {
  return generateUniqueSlug({ title, excludeId });
}

export async function createCollection(payload = {}, actor = null) {
  assertAdminActor(actor);
  const normalized = normalizeCollectionInput(payload);
  validateDateWindow(normalized.startsAt, normalized.endsAt);
  const slug = await ensureUniqueSlugForCreate(normalized.title || normalized.titleAr || normalized.placementKey || "collection");

  const items = normalized.items || [];
  await validateCollectionItemsForAdmin(items);

  const next = {
    slug,
    title: normalized.title,
    titleAr: normalized.titleAr,
    subtitle: normalized.subtitle,
    subtitleAr: normalized.subtitleAr,
    description: normalized.description,
    descriptionAr: normalized.descriptionAr,
    bannerUrl: normalized.bannerUrl,
    mobileBannerUrl: normalized.mobileBannerUrl,
    placementKey: normalized.placementKey,
    theme: normalized.theme,
    priority: normalized.priority,
    startsAt: normalized.startsAt,
    endsAt: normalized.endsAt,
    active: normalized.active,
    published: normalized.published == null ? false : normalized.published,
    items,
    createdBy: normalizeText(actor?.sub || actor?.id || ""),
    updatedBy: normalizeText(actor?.sub || actor?.id || ""),
  };

  const persisted = await persistCollection(next, true);
  return getAdminCollection(persisted.id || persisted._id);
}

export async function updateCollection(id, payload = {}, actor = null) {
  assertAdminActor(actor);
  const existing = await findCollectionById(id);
  if (!existing) {
    throw createHttpError(404, "Curated collection not found.");
  }

  const normalized = normalizeCollectionInput(payload);
  const nextStartsAt = Object.prototype.hasOwnProperty.call(payload, "startsAt") ? normalized.startsAt : normalizeDate(existing.startsAt);
  const nextEndsAt = Object.prototype.hasOwnProperty.call(payload, "endsAt") ? normalized.endsAt : normalizeDate(existing.endsAt);
  validateDateWindow(nextStartsAt, nextEndsAt);

  const nextItems = Object.prototype.hasOwnProperty.call(payload, "items")
    ? (normalized.items || [])
    : sanitizeStoredCollection(existing).items || [];
  if (Object.prototype.hasOwnProperty.call(payload, "items")) {
    await validateCollectionItemsForAdmin(nextItems);
  }

  const existingStored = sanitizeStoredCollection(existing);
  const next = {
    ...existingStored,
    title: Object.prototype.hasOwnProperty.call(payload, "title") ? normalized.title : existingStored.title,
    titleAr: Object.prototype.hasOwnProperty.call(payload, "titleAr") ? normalized.titleAr : existingStored.titleAr,
    subtitle: Object.prototype.hasOwnProperty.call(payload, "subtitle") ? normalized.subtitle : existingStored.subtitle,
    subtitleAr: Object.prototype.hasOwnProperty.call(payload, "subtitleAr") ? normalized.subtitleAr : existingStored.subtitleAr,
    description: Object.prototype.hasOwnProperty.call(payload, "description") ? normalized.description : existingStored.description,
    descriptionAr: Object.prototype.hasOwnProperty.call(payload, "descriptionAr") ? normalized.descriptionAr : existingStored.descriptionAr,
    bannerUrl: Object.prototype.hasOwnProperty.call(payload, "bannerUrl") ? normalized.bannerUrl : existingStored.bannerUrl,
    mobileBannerUrl: Object.prototype.hasOwnProperty.call(payload, "mobileBannerUrl") ? normalized.mobileBannerUrl : existingStored.mobileBannerUrl,
    placementKey: Object.prototype.hasOwnProperty.call(payload, "placementKey") ? normalizePlacementKey(normalized.placementKey) : existingStored.placementKey,
    theme: Object.prototype.hasOwnProperty.call(payload, "theme") ? normalized.theme : existingStored.theme,
    priority: Object.prototype.hasOwnProperty.call(payload, "priority") ? normalized.priority : existingStored.priority,
    startsAt: nextStartsAt,
    endsAt: nextEndsAt,
    active: Object.prototype.hasOwnProperty.call(payload, "active") ? normalized.active : existingStored.active,
    published: Object.prototype.hasOwnProperty.call(payload, "published")
      ? (normalized.published == null ? false : normalized.published)
      : existingStored.published,
    items: nextItems,
    updatedBy: normalizeText(actor?.sub || actor?.id || ""),
    id: existingStored.id,
    slug: existingStored.slug,
  };

  const persisted = await persistCollection(next, false);
  return getAdminCollection(persisted.id || persisted._id);
}

export async function deleteCollection(id, actor = null) {
  assertAdminActor(actor);
  const existing = await findCollectionById(id);
  if (!existing) {
    throw createHttpError(404, "Curated collection not found.");
  }

  const existingStored = sanitizeStoredCollection(existing);
  const next = {
    ...existingStored,
    active: false,
    updatedBy: normalizeText(actor?.sub || actor?.id || ""),
    id: existingStored.id,
    slug: existingStored.slug,
  };

  const persisted = await persistCollection(next, false);
  return getAdminCollection(persisted.id || persisted._id);
}

function normalizePublicCollection(collection) {
  const stored = sanitizeStoredCollection(collection);
  return {
    id: stored.id,
    slug: stored.slug,
    title: stored.title,
    titleAr: stored.titleAr,
    subtitle: stored.subtitle,
    subtitleAr: stored.subtitleAr,
    description: stored.description,
    descriptionAr: stored.descriptionAr,
    bannerUrl: stored.bannerUrl,
    mobileBannerUrl: stored.mobileBannerUrl,
    placementKey: stored.placementKey,
    theme: stored.theme,
    priority: stored.priority,
    startsAt: stored.startsAt,
    endsAt: stored.endsAt,
    active: stored.active,
    published: stored.published,
    items: [],
  };
}

export async function listPublicCollections() {
  const collections = await loadCollections();
  const validCollections = collections
    .filter((collection) => isDateWindowActive(collection, new Date()))
    .sort(compareTopLevelCollections);

  const publicCollections = [];
  for (const collection of validCollections) {
    const stored = sanitizeStoredCollection(collection);
    const sortedItems = sortCollectionItems(stored.items || []);
    const items = [];
    for (const item of sortedItems) {
      const publicItem = await buildCollectionPublicItem(item);
      if (publicItem) items.push(publicItem);
    }
    publicCollections.push({
      ...normalizePublicCollection(collection),
      items,
    });
  }

  return publicCollections;
}

export async function getPublicCollectionBySlug(slug) {
  const collection = await findCollectionBySlug(slug);
  if (!collection || !isDateWindowActive(collection, new Date())) {
    throw createHttpError(404, "Curated collection not found.");
  }
  const stored = sanitizeStoredCollection(collection);
  const sortedItems = sortCollectionItems(stored.items || []);
  const items = [];
  for (const item of sortedItems) {
    const publicItem = await buildCollectionPublicItem(item);
    if (publicItem) items.push(publicItem);
  }

  return {
    ...normalizePublicCollection(collection),
    items,
  };
}

export function __resetCuratedCollectionsForTests() {
  if (env.mongoUri) return;
  seedCuratedCollections.clear();
  const state = seedRepository.getState();
  state.curatedCollections = [];
}
