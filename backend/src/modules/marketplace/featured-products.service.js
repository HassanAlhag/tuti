import { randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env.js";
import { FeaturedProductPlacement, FEATURED_PRODUCT_PLACEMENT_KEYS } from "../../models/FeaturedProductPlacement.js";
import { Product } from "../../models/Product.js";
import { Shop } from "../../models/Shop.js";
import { seedRepository } from "../../repositories/seedRepository.js";

const DEFAULT_PLACEMENT_KEY = "homepage_featured_products";

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

function normalizePlacementKey(value, { allowDefault = false } = {}) {
  const normalized = normalizeText(value);
  if (!normalized) return allowDefault ? DEFAULT_PLACEMENT_KEY : "";
  if (FEATURED_PRODUCT_PLACEMENT_KEYS.includes(normalized)) return normalized;
  return "";
}

function normalizePlacementKeyOrThrow(value) {
  const key = normalizePlacementKey(value, { allowDefault: true });
  if (!key) {
    throw createHttpError(
      400,
      `Invalid placement key. Allowed keys: ${FEATURED_PRODUCT_PLACEMENT_KEYS.join(", ")}.`
    );
  }
  return key;
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

function normalizePlacementInput(payload = {}) {
  return {
    placementKey: normalizePlacementKey(payload.placementKey, { allowDefault: true }),
    titleOverride: normalizeText(payload.titleOverride),
    subtitleOverride: normalizeText(payload.subtitleOverride),
    imageOverrideUrl: normalizeText(payload.imageOverrideUrl),
    badgeLabel: normalizeText(payload.badgeLabel),
    priority: toNumber(payload.priority, 0),
    startsAt: normalizeDate(payload.startsAt),
    endsAt: normalizeDate(payload.endsAt),
    active: toBoolean(payload.active, true),
  };
}

function assertAdminActor(actor) {
  if (!actor || actor.role !== "admin") {
    throw createHttpError(403, "Admin permissions required.");
  }
}

function isPlacementInDateWindow(placement, now = new Date()) {
  if (!placement?.active) return false;
  const current = now instanceof Date ? now : new Date(now);
  const startsAt = normalizeDate(placement.startsAt);
  const endsAt = normalizeDate(placement.endsAt);
  if (startsAt && current < startsAt) return false;
  if (endsAt && current > endsAt) return false;
  return true;
}

function sanitizeStoredPlacement(placement) {
  if (!placement) return null;
  return {
    id: placement._id ? String(placement._id) : normalizeText(placement.id) || null,
    productId: normalizeText(placement.productId),
    shopId: normalizeText(placement.shopId),
    placementKey: normalizePlacementKey(placement.placementKey, { allowDefault: true }) || DEFAULT_PLACEMENT_KEY,
    titleOverride: normalizeText(placement.titleOverride),
    subtitleOverride: normalizeText(placement.subtitleOverride),
    imageOverrideUrl: normalizeText(placement.imageOverrideUrl),
    badgeLabel: normalizeText(placement.badgeLabel),
    priority: toNumber(placement.priority, 0),
    startsAt: normalizeDate(placement.startsAt),
    endsAt: normalizeDate(placement.endsAt),
    active: Boolean(placement.active),
    createdBy: normalizeText(placement.createdBy),
    updatedBy: normalizeText(placement.updatedBy),
    createdAt: placement.createdAt || null,
    updatedAt: placement.updatedAt || null,
  };
}

function normalizePublicShop(shop) {
  if (!shop) return null;
  return {
    id: normalizeText(shop.id),
    name: normalizeText(shop.name),
    city: normalizeText(shop.city),
    avatar: normalizeText(shop.avatar),
  };
}

function normalizePublicProduct(product) {
  if (!product) return null;
  return {
    id: product.id,
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

function normalizeAdminProduct(product) {
  const publicProduct = normalizePublicProduct(product);
  if (!publicProduct) return null;
  return {
    ...publicProduct,
    shopId: normalizeText(product.shopId),
    sellerLastEditedAt: product.sellerLastEditedAt || null,
  };
}

function normalizeAdminShop(shop) {
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

function humanizePlacementBadge(product) {
  const release = normalizeText(product?.releaseType);
  if (release) return release;
  const category = normalizeText(product?.category);
  if (!category) return "";
  if (category === "gift_box" || category === "bundle") return "Gift Set";
  if (category === "cake" || category === "dessert") return "Treat";
  if (category === "perfume") return "Perfume";
  return category.replace(/_/g, " ");
}

function resolvePlacementDisplay(placement, product) {
  return {
    title: normalizeText(placement.titleOverride) || normalizeText(product?.name) || "Featured product",
    subtitle: normalizeText(placement.subtitleOverride)
      || normalizeText(product?.family)
      || normalizeText(product?.collection)
      || normalizeText(product?.description)
      || "",
    imageUrl: normalizeText(placement.imageOverrideUrl) || normalizeText(product?.imagePath) || "",
    badgeLabel: normalizeText(placement.badgeLabel) || humanizePlacementBadge(product),
  };
}

function comparePlacements(left, right) {
  if (left.priority !== right.priority) return right.priority - left.priority;
  const leftCreated = new Date(left.createdAt || 0).getTime();
  const rightCreated = new Date(right.createdAt || 0).getTime();
  return rightCreated - leftCreated;
}

function compareAdminPlacements(left, right) {
  if (Boolean(left.active) !== Boolean(right.active)) return Boolean(right.active) - Boolean(left.active);
  return comparePlacements(left, right);
}

async function loadPlacements() {
  if (env.mongoUri) {
    return FeaturedProductPlacement.find({}).lean();
  }
  return [...(seedRepository.getState().featuredProductPlacements || [])].map((placement) => clone(placement));
}

async function loadCatalog() {
  if (env.mongoUri) {
    const [products, shops] = await Promise.all([
      Product.find({}).lean(),
      Shop.find({}).lean(),
    ]);
    return {
      productsById: new Map(products.map((product) => [normalizeText(product.id), product])),
      shopsById: new Map(shops.map((shop) => [normalizeText(shop.id), shop])),
    };
  }

  const state = seedRepository.getState();
  return {
    productsById: new Map((state.products || []).map((product) => [normalizeText(product.id), product])),
    shopsById: new Map((state.shops || []).map((shop) => [normalizeText(shop.id), shop])),
  };
}

async function findPlacementById(id) {
  if (!id) return null;
  if (env.mongoUri) {
    return FeaturedProductPlacement.findById(id).lean();
  }
  return clone((seedRepository.getState().featuredProductPlacements || []).find((placement) => String(placement.id) === String(id)) || null);
}

async function findActivePlacementForProductKey(productId, placementKey, excludeId = null) {
  const placements = await loadPlacements();
  return placements.find((placement) => {
    if (excludeId && String(placement._id || placement.id || "") === String(excludeId)) return false;
    return normalizeText(placement.productId) === normalizeText(productId)
      && normalizePlacementKey(placement.placementKey, { allowDefault: true }) === normalizePlacementKey(placementKey, { allowDefault: true })
      && Boolean(placement.active);
  }) || null;
}

function isProductPubliclyVisible(product, shop) {
  if (!product || !shop) return false;
  if (normalizeText(product.status) !== "Live") return false;
  if (normalizeText(shop.status) !== "Approved") return false;
  return true;
}

function buildPlacementAdminRecord(placement, product, shop) {
  const stored = sanitizeStoredPlacement(placement);
  const display = resolvePlacementDisplay(stored, product);
  return {
    ...stored,
    ...display,
    product: normalizeAdminProduct(product),
    shop: normalizeAdminShop(shop),
  };
}

function buildPlacementPublicRecord(placement, product, shop) {
  const stored = sanitizeStoredPlacement(placement);
  const display = resolvePlacementDisplay(stored, product);
  return {
    id: stored.id,
    placementKey: stored.placementKey,
    priority: stored.priority,
    startsAt: stored.startsAt,
    endsAt: stored.endsAt,
    title: display.title,
    subtitle: display.subtitle,
    imageUrl: display.imageUrl,
    badgeLabel: display.badgeLabel,
    product: normalizePublicProduct(product),
    shop: normalizePublicShop(shop),
  };
}

function isDuplicateKeyError(error) {
  return Boolean(error && (error.code === 11000 || error.code === 11001 || /duplicate key/i.test(error.message || "")));
}

async function persistPlacement(placement, isNew = false) {
  if (env.mongoUri) {
    try {
      if (isNew) {
        const created = await FeaturedProductPlacement.create(placement);
        return created.toObject();
      }
      const updated = await FeaturedProductPlacement.findByIdAndUpdate(
        placement.id || placement._id,
        placement,
        { new: true }
      ).lean();
      return updated;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw createHttpError(409, "An active featured placement already exists for this product and placement key.");
      }
      throw error;
    }
  }

  const state = seedRepository.getState();
  if (!state.featuredProductPlacements) state.featuredProductPlacements = [];
  const next = {
    ...clone(placement),
    id: placement.id || randomUUID(),
    createdAt: placement.createdAt || new Date(),
    updatedAt: new Date(),
  };
  const index = state.featuredProductPlacements.findIndex((item) => String(item.id) === String(next.id));
  if (index >= 0) {
    state.featuredProductPlacements[index] = next;
  } else {
    state.featuredProductPlacements.unshift(next);
  }
  return clone(next);
}

async function resolveProductAndShopForCreate(productId, shopId) {
  const { productsById, shopsById } = await loadCatalog();
  const product = productsById.get(normalizeText(productId)) || null;
  const shop = shopsById.get(normalizeText(shopId)) || null;

  if (!product) {
    throw createHttpError(404, "Product not found.");
  }
  if (!shop) {
    throw createHttpError(404, "Shop not found.");
  }
  if (normalizeText(product.shopId) !== normalizeText(shop.id)) {
    throw createHttpError(400, "The featured product must belong to the linked shop.");
  }

  return { product, shop };
}

async function resolveProductAndShopForPlacement(placement) {
  const { productsById, shopsById } = await loadCatalog();
  return {
    product: productsById.get(normalizeText(placement.productId)) || null,
    shop: shopsById.get(normalizeText(placement.shopId)) || null,
  };
}

export const featuredProductPlacementCreateSchema = z.object({
  productId: z.string().trim().min(1),
  shopId: z.string().trim().min(1),
  placementKey: z.enum(FEATURED_PRODUCT_PLACEMENT_KEYS).optional(),
  titleOverride: z.string().trim().optional(),
  subtitleOverride: z.string().trim().optional(),
  imageOverrideUrl: z.string().trim().optional(),
  badgeLabel: z.string().trim().optional(),
  priority: z.union([z.number(), z.string()]).optional(),
  startsAt: z.union([z.string(), z.date()]).optional().nullable(),
  endsAt: z.union([z.string(), z.date()]).optional().nullable(),
  active: z.union([z.boolean(), z.string()]).optional(),
});

export const featuredProductPlacementUpdateSchema = z.object({
  placementKey: z.enum(FEATURED_PRODUCT_PLACEMENT_KEYS).optional(),
  titleOverride: z.string().trim().optional(),
  subtitleOverride: z.string().trim().optional(),
  imageOverrideUrl: z.string().trim().optional(),
  badgeLabel: z.string().trim().optional(),
  priority: z.union([z.number(), z.string()]).optional(),
  startsAt: z.union([z.string(), z.date()]).optional().nullable(),
  endsAt: z.union([z.string(), z.date()]).optional().nullable(),
  active: z.union([z.boolean(), z.string()]).optional(),
});

export async function listAdminFeaturedProductPlacements(filters = {}) {
  const { placementKey, productId, shopId, active } = filters || {};
  const placements = await loadPlacements();
  const filtered = placements.filter((placement) => {
    if (placementKey && normalizePlacementKey(placement.placementKey, { allowDefault: true }) !== normalizePlacementKey(placementKey, { allowDefault: true })) return false;
    if (productId && normalizeText(placement.productId) !== normalizeText(productId)) return false;
    if (shopId && normalizeText(placement.shopId) !== normalizeText(shopId)) return false;
    if (active != null && String(placement.active) !== String(active === true || active === "true")) return false;
    return true;
  });

  const hydrated = await Promise.all(
    filtered
      .sort(compareAdminPlacements)
      .map(async (placement) => {
        const { product, shop } = await resolveProductAndShopForPlacement(placement);
        return buildPlacementAdminRecord(placement, product, shop);
      })
  );

  return hydrated;
}

export async function createFeaturedProductPlacement(payload = {}, actor = null) {
  assertAdminActor(actor);
  const normalized = normalizePlacementInput(payload);
  const placementKey = normalizePlacementKeyOrThrow(payload.placementKey || DEFAULT_PLACEMENT_KEY);

  if (normalized.startsAt && normalized.endsAt && normalized.startsAt > normalized.endsAt) {
    throw createHttpError(400, "startsAt must be before endsAt.");
  }

  const { product, shop } = await resolveProductAndShopForCreate(payload.productId, payload.shopId);
  const duplicate = await findActivePlacementForProductKey(payload.productId, placementKey);
  if (normalized.active && duplicate) {
    throw createHttpError(409, "An active featured placement already exists for this product and placement key.");
  }

  const next = {
    productId: normalizeText(payload.productId),
    shopId: normalizeText(payload.shopId),
    placementKey,
    titleOverride: normalized.titleOverride,
    subtitleOverride: normalized.subtitleOverride,
    imageOverrideUrl: normalized.imageOverrideUrl,
    badgeLabel: normalized.badgeLabel,
    priority: normalized.priority,
    startsAt: normalized.startsAt,
    endsAt: normalized.endsAt,
    active: normalized.active,
    createdBy: normalizeText(actor?.sub || actor?.id || ""),
    updatedBy: normalizeText(actor?.sub || actor?.id || ""),
  };

  const persisted = await persistPlacement(next, true);
  return buildPlacementAdminRecord(persisted, product, shop);
}

export async function updateFeaturedProductPlacement(id, payload = {}, actor = null) {
  assertAdminActor(actor);
  const existing = await findPlacementById(id);
  if (!existing) {
    throw createHttpError(404, "Featured product placement not found.");
  }

  const normalized = normalizePlacementInput(payload);
  const nextPlacementKey = Object.prototype.hasOwnProperty.call(payload, "placementKey")
    ? normalizePlacementKeyOrThrow(payload.placementKey)
    : normalizePlacementKey(existing.placementKey, { allowDefault: true });
  const nextActive = Object.prototype.hasOwnProperty.call(payload, "active") ? normalized.active : Boolean(existing.active);
  const nextStartsAt = Object.prototype.hasOwnProperty.call(payload, "startsAt") ? normalized.startsAt : normalizeDate(existing.startsAt);
  const nextEndsAt = Object.prototype.hasOwnProperty.call(payload, "endsAt") ? normalized.endsAt : normalizeDate(existing.endsAt);
  if (nextStartsAt && nextEndsAt && nextStartsAt > nextEndsAt) {
    throw createHttpError(400, "startsAt must be before endsAt.");
  }

  const duplicate = await findActivePlacementForProductKey(existing.productId, nextPlacementKey, id);
  if (nextActive && duplicate) {
    throw createHttpError(409, "An active featured placement already exists for this product and placement key.");
  }

  const existingStored = sanitizeStoredPlacement(existing);
  const next = {
    ...existingStored,
    placementKey: nextPlacementKey,
    titleOverride: Object.prototype.hasOwnProperty.call(payload, "titleOverride") ? normalized.titleOverride : existingStored.titleOverride,
    subtitleOverride: Object.prototype.hasOwnProperty.call(payload, "subtitleOverride") ? normalized.subtitleOverride : existingStored.subtitleOverride,
    imageOverrideUrl: Object.prototype.hasOwnProperty.call(payload, "imageOverrideUrl") ? normalized.imageOverrideUrl : existingStored.imageOverrideUrl,
    badgeLabel: Object.prototype.hasOwnProperty.call(payload, "badgeLabel") ? normalized.badgeLabel : existingStored.badgeLabel,
    priority: Object.prototype.hasOwnProperty.call(payload, "priority") ? normalized.priority : existingStored.priority,
    startsAt: nextStartsAt,
    endsAt: nextEndsAt,
    active: nextActive,
    updatedBy: normalizeText(actor?.sub || actor?.id || ""),
    id: existingStored.id,
    productId: existingStored.productId,
    shopId: existingStored.shopId,
  };

  const persisted = await persistPlacement(next, false);
  const { product, shop } = await resolveProductAndShopForPlacement(persisted);
  return buildPlacementAdminRecord(persisted, product, shop);
}

export async function deleteFeaturedProductPlacement(id, actor = null) {
  assertAdminActor(actor);
  const existing = await findPlacementById(id);
  if (!existing) {
    throw createHttpError(404, "Featured product placement not found.");
  }

  const next = {
    ...sanitizeStoredPlacement(existing),
    active: false,
    updatedBy: normalizeText(actor?.sub || actor?.id || ""),
  };

  const persisted = await persistPlacement(next, false);
  const { product, shop } = await resolveProductAndShopForPlacement(persisted);
  return buildPlacementAdminRecord(persisted, product, shop);
}

export async function listPublicFeaturedProductPlacements(placementKey = DEFAULT_PLACEMENT_KEY) {
  const resolvedPlacementKey = normalizePlacementKey(placementKey, { allowDefault: true });
  if (!resolvedPlacementKey) return [];

  const placements = await loadPlacements();
  const now = new Date();
  const { productsById, shopsById } = await loadCatalog();

  const filtered = placements
    .filter((placement) => normalizePlacementKey(placement.placementKey, { allowDefault: true }) === resolvedPlacementKey)
    .filter((placement) => isPlacementInDateWindow(placement, now))
    .sort(comparePlacements);

  const publicPlacements = [];
  for (const placement of filtered) {
    const product = productsById.get(normalizeText(placement.productId)) || null;
    const shop = shopsById.get(normalizeText(placement.shopId)) || null;
    if (!isProductPubliclyVisible(product, shop)) continue;
    publicPlacements.push(buildPlacementPublicRecord(placement, product, shop));
  }

  return publicPlacements;
}

export function __resetFeaturedProductPlacementsForTests() {
  if (env.mongoUri) return;
  const state = seedRepository.getState();
  state.featuredProductPlacements = [];
}
