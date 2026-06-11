import { randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env.js";
import { FeaturedSellerPlacement } from "../../models/FeaturedSellerPlacement.js";
import { getSellerBrandProfile } from "./brandProfile.service.js";

const seedFeaturedSellerPlacements = new Map();

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
  return normalizeText(value) || "homepage_featured_sellers";
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
    placementKey: normalizePlacementKey(payload.placementKey),
    titleOverride: normalizeText(payload.titleOverride),
    subtitleOverride: normalizeText(payload.subtitleOverride),
    imageOverrideUrl: normalizeText(payload.imageOverrideUrl),
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
    shopId: normalizeText(placement.shopId),
    brandProfileId: normalizeText(placement.brandProfileId),
    placementKey: normalizePlacementKey(placement.placementKey),
    titleOverride: normalizeText(placement.titleOverride),
    subtitleOverride: normalizeText(placement.subtitleOverride),
    imageOverrideUrl: normalizeText(placement.imageOverrideUrl),
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

function sanitizePublicBrandProfile(profile) {
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

function buildPlacementAdminRecord(placement, brandProfile) {
  const stored = sanitizeStoredPlacement(placement);
  return {
    ...stored,
    brandProfile: brandProfile
      ? {
        id: brandProfile.id || null,
        slug: normalizeText(brandProfile.slug),
        displayName: normalizeText(brandProfile.displayName),
        displayNameAr: normalizeText(brandProfile.displayNameAr),
        shortTagline: normalizeText(brandProfile.shortTagline),
        shortTaglineAr: normalizeText(brandProfile.shortTaglineAr),
        published: Boolean(brandProfile.published),
        completenessScore: toNumber(brandProfile.completenessScore, 0),
      }
      : null,
  };
}

function buildPlacementPublicRecord(placement, brandProfile) {
  const stored = sanitizeStoredPlacement(placement);
  const publicProfile = sanitizePublicBrandProfile(brandProfile);
  return {
    placementKey: stored.placementKey,
    priority: stored.priority,
    startsAt: stored.startsAt,
    endsAt: stored.endsAt,
    title: stored.titleOverride || publicProfile?.displayName || "",
    subtitle: stored.subtitleOverride || publicProfile?.shortTagline || "",
    imageUrl: stored.imageOverrideUrl || publicProfile?.bannerUrl || publicProfile?.logoUrl || "",
    seller: publicProfile,
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
    return FeaturedSellerPlacement.find({}).lean();
  }
  return [...seedFeaturedSellerPlacements.values()].map((placement) => clone(placement));
}

async function findPlacementById(id) {
  if (!id) return null;
  if (env.mongoUri) {
    return FeaturedSellerPlacement.findById(id).lean();
  }
  return clone(seedFeaturedSellerPlacements.get(id) || null);
}

async function findActivePlacementForShopKey(shopId, placementKey, excludeId = null) {
  const placements = await loadPlacements();
  return placements.find((placement) => {
    if (excludeId && String(placement._id || placement.id || "") === String(excludeId)) return false;
    return normalizeText(placement.shopId) === normalizeText(shopId)
      && normalizePlacementKey(placement.placementKey) === normalizePlacementKey(placementKey)
      && Boolean(placement.active);
  }) || null;
}

async function resolvePublishedBrandProfileForShop(shopId, brandProfileId) {
  const brandProfile = await getSellerBrandProfile(shopId);
  if (!brandProfile?.id || !brandProfile.published) {
    throw createHttpError(400, "Seller brand profile must be published before it can be featured.");
  }
  if (normalizeText(brandProfile.id) !== normalizeText(brandProfileId)) {
    throw createHttpError(400, "The featured seller must reference the linked brand profile.");
  }
  return brandProfile;
}

function validateDateWindow(startsAt, endsAt) {
  if (startsAt && endsAt && startsAt > endsAt) {
    throw createHttpError(400, "startsAt must be before endsAt.");
  }
}

function isDuplicateKeyError(error) {
  return Boolean(error && (error.code === 11000 || error.code === 11001 || /duplicate key/i.test(error.message || "")));
}

async function persistPlacement(placement, isNew = false) {
  if (env.mongoUri) {
    try {
      if (isNew) {
        const created = await FeaturedSellerPlacement.create(placement);
        return created.toObject();
      }
      const updated = await FeaturedSellerPlacement.findByIdAndUpdate(
        placement.id || placement._id,
        placement,
        { new: true }
      ).lean();
      return updated;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw createHttpError(409, "An active featured placement already exists for this seller and placement key.");
      }
      throw error;
    }
  }

  const next = {
    ...clone(placement),
    id: placement.id || randomUUID(),
    createdAt: placement.createdAt || new Date(),
    updatedAt: new Date(),
  };
  seedFeaturedSellerPlacements.set(next.id, next);
  return clone(next);
}

export const featuredSellerPlacementCreateSchema = z.object({
  shopId: z.string().trim().min(1),
  brandProfileId: z.string().trim().min(1),
  placementKey: z.string().trim().min(1).optional(),
  titleOverride: z.string().trim().optional(),
  subtitleOverride: z.string().trim().optional(),
  imageOverrideUrl: z.string().trim().optional(),
  priority: z.union([z.number(), z.string()]).optional(),
  startsAt: z.union([z.string(), z.date()]).optional().nullable(),
  endsAt: z.union([z.string(), z.date()]).optional().nullable(),
  active: z.union([z.boolean(), z.string()]).optional(),
});

export const featuredSellerPlacementUpdateSchema = z.object({
  placementKey: z.string().trim().min(1).optional(),
  titleOverride: z.string().trim().optional(),
  subtitleOverride: z.string().trim().optional(),
  imageOverrideUrl: z.string().trim().optional(),
  priority: z.union([z.number(), z.string()]).optional(),
  startsAt: z.union([z.string(), z.date()]).optional().nullable(),
  endsAt: z.union([z.string(), z.date()]).optional().nullable(),
  active: z.union([z.boolean(), z.string()]).optional(),
});

export async function listAdminFeaturedSellerPlacements(filters = {}) {
  const { placementKey, shopId, active } = filters || {};
  const placements = await loadPlacements();
  const filtered = placements.filter((placement) => {
    if (placementKey && normalizePlacementKey(placement.placementKey) !== normalizePlacementKey(placementKey)) return false;
    if (shopId && normalizeText(placement.shopId) !== normalizeText(shopId)) return false;
    if (active != null && String(placement.active) !== String(active === true || active === "true")) return false;
    return true;
  });

  const hydrated = await Promise.all(
    filtered
      .sort(compareAdminPlacements)
      .map(async (placement) => {
        const brandProfile = await getSellerBrandProfile(placement.shopId);
        return buildPlacementAdminRecord(placement, brandProfile);
      })
  );

  return hydrated;
}

export async function createFeaturedSellerPlacement(payload = {}, actor = null) {
  assertAdminActor(actor);
  const normalized = normalizePlacementInput(payload);
  validateDateWindow(normalized.startsAt, normalized.endsAt);

  const brandProfile = await resolvePublishedBrandProfileForShop(payload.shopId, payload.brandProfileId);
  const duplicate = await findActivePlacementForShopKey(payload.shopId, normalized.placementKey);
  if (normalized.active && duplicate) {
    throw createHttpError(409, "An active featured placement already exists for this seller and placement key.");
  }

  const next = {
    shopId: normalizeText(payload.shopId),
    brandProfileId: normalizeText(payload.brandProfileId),
    placementKey: normalized.placementKey,
    titleOverride: normalized.titleOverride,
    subtitleOverride: normalized.subtitleOverride,
    imageOverrideUrl: normalized.imageOverrideUrl,
    priority: normalized.priority,
    startsAt: normalized.startsAt,
    endsAt: normalized.endsAt,
    active: normalized.active,
    createdBy: normalizeText(actor?.sub || actor?.id || ""),
    updatedBy: normalizeText(actor?.sub || actor?.id || ""),
  };

  const persisted = await persistPlacement(next, true);
  return buildPlacementAdminRecord(persisted, brandProfile);
}

export async function updateFeaturedSellerPlacement(id, payload = {}, actor = null) {
  assertAdminActor(actor);
  const existing = await findPlacementById(id);
  if (!existing) {
    throw createHttpError(404, "Featured seller placement not found.");
  }

  const normalized = normalizePlacementInput(payload);
  validateDateWindow(
    Object.prototype.hasOwnProperty.call(payload, "startsAt") ? normalized.startsAt : normalizeDate(existing.startsAt),
    Object.prototype.hasOwnProperty.call(payload, "endsAt") ? normalized.endsAt : normalizeDate(existing.endsAt)
  );

  const nextActive = Object.prototype.hasOwnProperty.call(payload, "active") ? normalized.active : Boolean(existing.active);
  const nextPlacementKey = Object.prototype.hasOwnProperty.call(payload, "placementKey")
    ? normalized.placementKey
    : normalizePlacementKey(existing.placementKey);

  const duplicate = await findActivePlacementForShopKey(existing.shopId, nextPlacementKey, id);
  if (nextActive && duplicate) {
    throw createHttpError(409, "An active featured placement already exists for this seller and placement key.");
  }

  const brandProfile = await getSellerBrandProfile(existing.shopId);
  const existingStored = sanitizeStoredPlacement(existing);
  const next = {
    ...existingStored,
    placementKey: nextPlacementKey,
    titleOverride: Object.prototype.hasOwnProperty.call(payload, "titleOverride") ? normalized.titleOverride : existingStored.titleOverride,
    subtitleOverride: Object.prototype.hasOwnProperty.call(payload, "subtitleOverride") ? normalized.subtitleOverride : existingStored.subtitleOverride,
    imageOverrideUrl: Object.prototype.hasOwnProperty.call(payload, "imageOverrideUrl") ? normalized.imageOverrideUrl : existingStored.imageOverrideUrl,
    priority: Object.prototype.hasOwnProperty.call(payload, "priority") ? normalized.priority : existingStored.priority,
    startsAt: Object.prototype.hasOwnProperty.call(payload, "startsAt") ? normalized.startsAt : existingStored.startsAt,
    endsAt: Object.prototype.hasOwnProperty.call(payload, "endsAt") ? normalized.endsAt : existingStored.endsAt,
    active: nextActive,
    updatedBy: normalizeText(actor?.sub || actor?.id || ""),
    id: existingStored.id,
    shopId: existingStored.shopId,
    brandProfileId: existingStored.brandProfileId,
  };

  const persisted = await persistPlacement(next, false);
  return buildPlacementAdminRecord(persisted, brandProfile);
}

export async function deleteFeaturedSellerPlacement(id, actor = null) {
  assertAdminActor(actor);
  const existing = await findPlacementById(id);
  if (!existing) {
    throw createHttpError(404, "Featured seller placement not found.");
  }

  const brandProfile = await getSellerBrandProfile(existing.shopId);
  const next = {
    ...sanitizeStoredPlacement(existing),
    active: false,
    updatedBy: normalizeText(actor?.sub || actor?.id || ""),
  };

  const persisted = await persistPlacement(next, false);
  return buildPlacementAdminRecord(persisted, brandProfile);
}

export async function listPublicFeaturedSellerPlacements(placementKey = "homepage_featured_sellers") {
  const placements = await loadPlacements();
  const now = new Date();
  const filtered = placements
    .filter((placement) => normalizePlacementKey(placement.placementKey) === normalizePlacementKey(placementKey))
    .filter((placement) => isPlacementInDateWindow(placement, now))
    .sort(comparePlacements);

  const publicPlacements = [];
  for (const placement of filtered) {
    const brandProfile = await getSellerBrandProfile(placement.shopId);
    if (!brandProfile?.published || !brandProfile?.id) continue;
    publicPlacements.push(buildPlacementPublicRecord(placement, brandProfile));
  }

  return publicPlacements;
}

export function __resetFeaturedSellerPlacementsForTests() {
  seedFeaturedSellerPlacements.clear();
}
