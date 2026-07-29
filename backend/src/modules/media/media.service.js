import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { env } from "../../config/env.js";
import { logger } from "../../shared/logger.js";
import { seedRepository } from "../../repositories/seedRepository.js";
import { MediaAsset } from "../../models/MediaAsset.js";
import { ProductMediaLink } from "../../models/ProductMediaLink.js";
import { Product } from "../../models/Product.js";
import {
  RECOMMENDED_MIN_WIDTH,
  RECOMMENDED_MIN_HEIGHT,
  optimizeAndPersistImage,
  resolveMediaUrls,
  deleteMediaVariants,
  sanitizeOriginalFilename,
  sha256,
} from "../../shared/mediaStorage.js";
import { uploadsDir } from "../../shared/uploadsDir.js";

const MAX_GALLERY_IMAGES = 10; // primary + up to 9 gallery

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function clampPage(value) {
  return Math.max(Number(value) || 1, 1);
}

function clampLimit(value, fallback = 24, max = 100) {
  return Math.min(Math.max(Number(value) || fallback, 1), max);
}

// ── Sanitization ─────────────────────────────────────────────────────────

/**
 * Resolves CloudFront/presigned URLs for the asset's three variants and
 * returns a client-safe view. AWS credentials, local disk paths, the
 * checksum (internal dedupe use only), and uploader identity are
 * deliberately never included -- seller/admin surfaces get everything
 * they need (previews, dimensions, sizes, moderation state) without any
 * of that.
 */
async function sanitizeMediaAsset(asset) {
  if (!asset) return null;
  const urls = await resolveMediaUrls(asset.variants);
  return {
    id: asset.id,
    ownerType: asset.ownerType,
    ownerId: asset.ownerId,
    shopId: asset.shopId || null,
    uploadedByRole: asset.uploadedByRole,
    originalFilename: asset.originalFilename || "",
    mimeType: asset.mimeType,
    width: asset.width ?? null,
    height: asset.height ?? null,
    altText: asset.altText || "",
    caption: asset.caption || "",
    status: asset.status,
    moderationStatus: asset.moderationStatus,
    createdAt: asset.createdAt || null,
    updatedAt: asset.updatedAt || null,
    urls, // { thumbnail, card, detail }
    publicUrl: urls.card, // convenience alias -- most grid/list UI just needs one representative preview
    variantMeta: {
      thumbnail: asset.variants?.thumbnail ? pickVariantMeta(asset.variants.thumbnail) : null,
      card: asset.variants?.card ? pickVariantMeta(asset.variants.card) : null,
      detail: asset.variants?.detail ? pickVariantMeta(asset.variants.detail) : null,
    },
  };
}

function pickVariantMeta(variant) {
  return { width: variant.width, height: variant.height, sizeBytes: variant.sizeBytes };
}

// ── Low-level accessors (Mongo vs seed) ─────────────────────────────────

async function insertMediaAsset(doc) {
  if (env.mongoUri) {
    const created = await MediaAsset.create(doc);
    return created.toObject();
  }
  const record = { ...doc, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  seedRepository.getState().mediaAssets.unshift(record);
  return record;
}

async function findMediaAssetById(mediaId) {
  if (env.mongoUri) return MediaAsset.findOne({ id: mediaId }).lean();
  return seedRepository.getState().mediaAssets.find((m) => m.id === mediaId) || null;
}

async function countLinksForAsset(mediaAssetId) {
  if (env.mongoUri) return ProductMediaLink.countDocuments({ mediaAssetId });
  return seedRepository.getState().productMediaLinks.filter((l) => l.mediaAssetId === mediaAssetId).length;
}

async function listLinksForAsset(mediaAssetId) {
  if (env.mongoUri) return ProductMediaLink.find({ mediaAssetId }).lean();
  return seedRepository.getState().productMediaLinks.filter((l) => l.mediaAssetId === mediaAssetId);
}

async function listLinksForProduct(productId) {
  if (env.mongoUri) return ProductMediaLink.find({ productId }).sort({ role: 1, position: 1 }).lean();
  return seedRepository
    .getState()
    .productMediaLinks.filter((l) => l.productId === productId)
    .sort((a, b) => (a.role === b.role ? a.position - b.position : a.role === "primary" ? -1 : 1));
}

async function deleteLinksForProduct(productId) {
  if (env.mongoUri) {
    await ProductMediaLink.deleteMany({ productId });
    return;
  }
  const state = seedRepository.getState();
  state.productMediaLinks = state.productMediaLinks.filter((l) => l.productId !== productId);
}

async function insertLinks(links) {
  if (!links.length) return;
  if (env.mongoUri) {
    await ProductMediaLink.insertMany(links);
    return;
  }
  seedRepository.getState().productMediaLinks.push(...links);
}

async function findProductLean(productId) {
  if (env.mongoUri) return Product.findOne({ id: productId }).lean();
  return seedRepository.getState().products.find((p) => p.id === productId) || null;
}

async function setProductImagePath(productId, imagePath) {
  if (env.mongoUri) {
    await Product.findOneAndUpdate({ id: productId }, { $set: { imagePath } });
    return;
  }
  const product = seedRepository.getState().products.find((p) => p.id === productId);
  if (product) product.imagePath = imagePath;
}

// Test-only failure injection for seed-mode transactional rollback tests.
let productMediaFailureStepForTests = null;
export function __setProductMediaFailureStepForTests(step) {
  productMediaFailureStepForTests = step;
}
export function __resetProductMediaFailureStepForTests() {
  productMediaFailureStepForTests = null;
}

function maybeThrowProductMediaFailure(step) {
  if (productMediaFailureStepForTests === step) {
    throw createHttpError(599, `Injected product media failure: ${step}`);
  }
}

// ── Upload ────────────────────────────────────────────────────────────

/**
 * Validates, optimizes (Sharp: thumbnail/card/detail WebP variants,
 * EXIF-rotated, metadata stripped), and persists an uploaded file to S3
 * (or local disk in dev/test), then records it as a MediaAsset. Ownership
 * (ownerType/ownerId/shopId/uploadedByUserId/uploadedByRole) must already
 * be resolved by the caller from verified server-side identity
 * (requireOwnedShop for sellers, req.user for admin/driver) -- this
 * function never reads ownership from client input.
 *
 * If the DB insert fails after S3 upload succeeded, every uploaded
 * variant is deleted before the error propagates (see Task 9) -- a
 * MediaAsset row and its S3 objects are never allowed to go out of sync.
 *
 * Returns { asset, dimensionWarning } where dimensionWarning is advisory
 * (below-recommended source resolution), never a rejection.
 */
export async function createMediaAsset({
  ownerType,
  ownerId,
  shopId = null,
  uploadedByUserId,
  uploadedByRole,
  buffer,
  originalFilename,
}) {
  const assetId = randomUUID();
  const { format, storageProvider, originalWidth, originalHeight, variants } = await optimizeAndPersistImage({
    buffer,
    ownerType,
    ownerId,
    assetId,
    uploadedByUserId,
    uploadsDir,
  });

  const doc = {
    id: assetId,
    ownerType,
    ownerId,
    shopId,
    uploadedByUserId: uploadedByUserId || null,
    uploadedByRole,
    storageProvider,
    variants,
    originalFilename: sanitizeOriginalFilename(originalFilename),
    mimeType: format,
    width: originalWidth,
    height: originalHeight,
    checksum: sha256(buffer), // internal dedupe use only, never serialized via sanitizeMediaAsset
    altText: "",
    caption: "",
    status: "active",
    moderationStatus: "pending",
  };

  let created;
  try {
    created = await insertMediaAsset(doc);
  } catch (err) {
    const cleanup = await deleteMediaVariants(variants, { uploadsDir });
    if (cleanup.failed.length) {
      logger.error({ assetId, failed: cleanup.failed }, "[media] Cleanup after DB insert failure left orphaned S3 variants");
    }
    throw err;
  }

  let dimensionWarning = null;
  if (originalWidth < RECOMMENDED_MIN_WIDTH || originalHeight < RECOMMENDED_MIN_HEIGHT) {
    dimensionWarning = `Image is ${originalWidth}×${originalHeight}px -- ${RECOMMENDED_MIN_WIDTH}×${RECOMMENDED_MIN_HEIGHT}px or larger is recommended for product photos.`;
  }

  return { asset: await sanitizeMediaAsset(created), dimensionWarning };
}

// ── Seller-scoped access ─────────────────────────────────────────────────

export async function listSellerMedia(shopId, { page = 1, limit = 24, q = "", productId = "" } = {}) {
  const safePage = clampPage(page);
  const safeLimit = clampLimit(limit);
  const query = normalizeText(q).toLowerCase();

  let productIdFilter = null;
  if (productId) {
    const links = await listLinksForProduct(productId);
    productIdFilter = new Set(links.map((l) => l.mediaAssetId));
  }

  if (env.mongoUri) {
    const filter = { shopId, status: { $ne: "deleted" } };
    if (query) filter.originalFilename = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (productIdFilter) filter.id = { $in: [...productIdFilter] };
    const skip = (safePage - 1) * safeLimit;
    const [items, total] = await Promise.all([
      MediaAsset.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
      MediaAsset.countDocuments(filter),
    ]);
    return withReferenceCounts(items, total, safePage, safeLimit);
  }

  let items = seedRepository.getState().mediaAssets.filter((m) => m.shopId === shopId && m.status !== "deleted");
  if (query) items = items.filter((m) => (m.originalFilename || "").toLowerCase().includes(query));
  if (productIdFilter) items = items.filter((m) => productIdFilter.has(m.id));
  items = [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const total = items.length;
  const start = (safePage - 1) * safeLimit;
  const page_ = items.slice(start, start + safeLimit);
  return withReferenceCounts(page_, total, safePage, safeLimit);
}

async function withReferenceCounts(items, total, page, limit) {
  const withCounts = await Promise.all(
    items.map(async (item) => ({
      ...(await sanitizeMediaAsset(item)),
      referenceCount: await countLinksForAsset(item.id),
    }))
  );
  return { items: withCounts, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getSellerMediaById(shopId, mediaId) {
  const asset = await findMediaAssetById(mediaId);
  if (!asset || asset.shopId !== shopId || asset.status === "deleted") {
    throw createHttpError(404, "Media not found.");
  }
  const links = await listLinksForAsset(mediaId);
  const products = await resolveProductSummaries(links.map((l) => l.productId));
  return { ...(await sanitizeMediaAsset(asset)), referenceCount: links.length, usedByProducts: products };
}

export async function updateSellerMedia(shopId, mediaId, payload = {}) {
  const asset = await findMediaAssetById(mediaId);
  if (!asset || asset.shopId !== shopId || asset.status === "deleted") {
    throw createHttpError(404, "Media not found.");
  }
  const update = {};
  if (payload.altText !== undefined) update.altText = normalizeText(payload.altText).slice(0, 200);
  if (payload.caption !== undefined) update.caption = normalizeText(payload.caption).slice(0, 400);

  if (env.mongoUri) {
    const updated = await MediaAsset.findOneAndUpdate({ id: mediaId }, { $set: update }, { new: true }).lean();
    return sanitizeMediaAsset(updated);
  }
  Object.assign(asset, update, { updatedAt: new Date().toISOString() });
  return sanitizeMediaAsset(asset);
}

export async function deleteSellerMedia(shopId, mediaId) {
  const asset = await findMediaAssetById(mediaId);
  if (!asset || asset.shopId !== shopId || asset.status === "deleted") {
    throw createHttpError(404, "Media not found.");
  }
  const refCount = await countLinksForAsset(mediaId);
  if (refCount > 0) {
    throw createHttpError(409, `This image is used by ${refCount} product${refCount === 1 ? "" : "s"}. Remove it from those products first.`);
  }
  await deleteAssetAndVariants(asset);
  return { ok: true };
}

/**
 * Deletes every S3 (or local) variant for an unreferenced asset, and only
 * marks the DB record deleted once ALL of them succeed -- variants must
 * fully succeed before the record does, not the other way around.
 *
 * If any variant deletion fails, the MediaAsset is left completely
 * untouched (still "active", still fully visible/listed to seller and
 * admin, storage keys intact) and a controlled 502 is thrown -- callers
 * must never soft-delete a record whose storage cleanup only partially
 * succeeded. The failure is logged as retryable. Retrying is safe and
 * idempotent: both S3's DeleteObjects and the local-disk delete path
 * treat an already-removed key as a success, not a failure, so a second
 * call only needs to clean up whatever is still actually there.
 */
async function deleteAssetAndVariants(asset) {
  const cleanup = await deleteMediaVariants(asset.variants, { uploadsDir });
  if (cleanup.failed.length) {
    logger.error({ assetId: asset.id, failed: cleanup.failed }, "[media] Deletion failed for one or more storage variants -- MediaAsset kept active for retry, not soft-deleted");
    throw createHttpError(502, "Could not delete this image from storage. Please try again.");
  }

  if (env.mongoUri) {
    await MediaAsset.findOneAndUpdate({ id: asset.id }, { $set: { status: "deleted" } });
    return;
  }
  const record = seedRepository.getState().mediaAssets.find((m) => m.id === asset.id);
  if (record) record.status = "deleted";
}

async function resolveProductSummaries(productIds) {
  const uniqueIds = [...new Set(productIds)];
  if (!uniqueIds.length) return [];
  if (env.mongoUri) {
    const products = await Product.find({ id: { $in: uniqueIds } }).select("id name status").lean();
    return products.map((p) => ({ id: p.id, name: p.name, status: p.status }));
  }
  const state = seedRepository.getState();
  return uniqueIds
    .map((id) => state.products.find((p) => p.id === id))
    .filter(Boolean)
    .map((p) => ({ id: p.id, name: p.name, status: p.status }));
}

// ── Admin access ─────────────────────────────────────────────────────────

export async function listAdminMedia({
  page = 1,
  limit = 24,
  q = "",
  shopId = "",
  ownerType = "",
  mimeType = "",
  moderationStatus = "",
  orphanedOnly = false,
  dateFrom = "",
  dateTo = "",
} = {}) {
  const safePage = clampPage(page);
  const safeLimit = clampLimit(limit);
  const query = normalizeText(q).toLowerCase();

  let items;

  if (env.mongoUri) {
    const filter = { status: { $ne: "deleted" } };
    if (shopId) filter.shopId = shopId;
    if (ownerType) filter.ownerType = ownerType;
    if (mimeType) filter.mimeType = mimeType;
    if (moderationStatus) filter.moderationStatus = moderationStatus;
    if (query) filter.originalFilename = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }
    items = await MediaAsset.find(filter).sort({ createdAt: -1 }).lean();
  } else {
    items = seedRepository.getState().mediaAssets.filter((m) => {
      if (m.status === "deleted") return false;
      if (shopId && m.shopId !== shopId) return false;
      if (ownerType && m.ownerType !== ownerType) return false;
      if (mimeType && m.mimeType !== mimeType) return false;
      if (moderationStatus && m.moderationStatus !== moderationStatus) return false;
      if (query && !(m.originalFilename || "").toLowerCase().includes(query)) return false;
      if (dateFrom && new Date(m.createdAt) < new Date(dateFrom)) return false;
      if (dateTo && new Date(m.createdAt) > new Date(dateTo)) return false;
      return true;
    });
    items = [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  const withCounts = await Promise.all(
    items.map(async (item) => ({ ...(await sanitizeMediaAsset(item)), referenceCount: await countLinksForAsset(item.id) }))
  );

  const filtered = orphanedOnly ? withCounts.filter((m) => m.referenceCount === 0) : withCounts;
  const total = filtered.length;
  const start = (safePage - 1) * safeLimit;
  const pageItems = filtered.slice(start, start + safeLimit);

  return { items: pageItems, total, page: safePage, limit: safeLimit, pages: Math.max(1, Math.ceil(total / safeLimit)) };
}

export async function getAdminMediaById(mediaId) {
  const asset = await findMediaAssetById(mediaId);
  if (!asset || asset.status === "deleted") throw createHttpError(404, "Media not found.");
  const links = await listLinksForAsset(mediaId);
  const products = await resolveProductSummaries(links.map((l) => l.productId));
  return { ...(await sanitizeMediaAsset(asset)), referenceCount: links.length, usedByProducts: products };
}

const MODERATION_ACTIONS = new Set(["approve", "reject", "quarantine"]);

/**
 * approve/reject set moderationStatus; quarantine is the more severe
 * action and also flips status so the asset stops being usable/renderable
 * anywhere until an admin restores it by approving again.
 */
export async function updateMediaModeration(mediaId, action) {
  if (!MODERATION_ACTIONS.has(action)) throw createHttpError(400, "Unknown moderation action.");
  const asset = await findMediaAssetById(mediaId);
  if (!asset || asset.status === "deleted") throw createHttpError(404, "Media not found.");

  const update = {};
  if (action === "approve") { update.moderationStatus = "approved"; update.status = "active"; }
  if (action === "reject") update.moderationStatus = "rejected";
  if (action === "quarantine") update.status = "quarantined";

  if (env.mongoUri) {
    const updated = await MediaAsset.findOneAndUpdate({ id: mediaId }, { $set: update }, { new: true }).lean();
    return sanitizeMediaAsset(updated);
  }
  Object.assign(asset, update, { updatedAt: new Date().toISOString() });
  return sanitizeMediaAsset(asset);
}

export async function deleteAdminMedia(mediaId) {
  const asset = await findMediaAssetById(mediaId);
  if (!asset || asset.status === "deleted") throw createHttpError(404, "Media not found.");
  const refCount = await countLinksForAsset(mediaId);
  if (refCount > 0) {
    throw createHttpError(409, `This image is used by ${refCount} product${refCount === 1 ? "" : "s"}. It cannot be deleted while referenced.`);
  }
  await deleteAssetAndVariants(asset);
  return { ok: true };
}

// ── Product <-> media linking ─────────────────────────────────────────────

/**
 * Replaces a product's media links with the given primary + gallery asset
 * ids. Every id must resolve to an active, non-rejected MediaAsset owned
 * by `shopId` -- cross-shop or quarantined/rejected assets are rejected
 * outright, never silently dropped. Also mirrors the resolved primary
 * image's card-variant URL onto Product.imagePath so every surface that
 * hasn't migrated to the gallery yet keeps working unchanged (Task 10).
 *
 * Pass `undefined` for a field to leave that side of the link set
 * untouched (e.g. a stock-only update should never touch media).
 *
 * Internally split into validateProductMediaSelection (read-only, throws
 * on any invalid/cross-shop/quarantined/rejected asset) and
 * commitProductMediaSelection (the actual writes) -- callers that need to
 * validate media alongside OTHER product mutations transactionally (see
 * marketplace.service.js's createSellerProduct/updateSellerProduct) call
 * those two directly instead of this convenience wrapper, so every
 * validation across the whole request happens before ANY write.
 */
export async function applyProductMediaLinks(productId, shopId, fields = {}) {
  const { primaryMediaAssetId, galleryMediaAssetIds } = fields;
  if (primaryMediaAssetId === undefined && galleryMediaAssetIds === undefined) return null;
  const selection = await validateExistingProductMediaSelection(productId, shopId, fields);
  return commitProductMediaSelection(productId, shopId, selection);
}

/**
 * Read-only validation of a proposed primary+gallery selection -- resolves
 * the media ids without requiring an existing Product. Creation flows use
 * this before the product exists; update flows first resolve undefined
 * fields against existing links in validateExistingProductMediaSelection.
 * Makes NO writes. Returns { primaryId, galleryIds, primaryAsset } for
 * commitProductMediaSelection.
 */
export async function validateProductMediaSelection(shopId, { primaryMediaAssetId, galleryMediaAssetIds } = {}) {
  const primaryId = primaryMediaAssetId ?? null;
  const galleryIds = galleryMediaAssetIds !== undefined ? [...new Set(galleryMediaAssetIds.filter(Boolean))] : [];
  return validateResolvedProductMediaSelection(shopId, { primaryId, galleryIds });
}

export async function validateExistingProductMediaSelection(productId, shopId, { primaryMediaAssetId, galleryMediaAssetIds } = {}) {
  const product = await findProductLean(productId);
  if (!product) throw createHttpError(404, "Product not found.");
  if (product.shopId !== shopId) throw createHttpError(403, "You do not own this product.");

  const existingLinks = await listLinksForProduct(productId);
  const primaryId = primaryMediaAssetId !== undefined
    ? primaryMediaAssetId
    : existingLinks.find((l) => l.role === "primary")?.mediaAssetId || null;
  const galleryIds = galleryMediaAssetIds !== undefined
    ? [...new Set(galleryMediaAssetIds.filter(Boolean))]
    : existingLinks.filter((l) => l.role === "gallery").map((l) => l.mediaAssetId);
  return validateResolvedProductMediaSelection(shopId, { primaryId, galleryIds });
}

async function validateResolvedProductMediaSelection(shopId, { primaryId = null, galleryIds = [] } = {}) {
  const allIds = [...(primaryId ? [primaryId] : []), ...galleryIds.filter((id) => id !== primaryId)];
  if (allIds.length > MAX_GALLERY_IMAGES) {
    throw createHttpError(422, `A product may have at most ${MAX_GALLERY_IMAGES} images.`);
  }
  if (new Set(allIds).size !== allIds.length) {
    throw createHttpError(422, "Each product image can only be selected once.");
  }

  const assets = await Promise.all(allIds.map((id) => findMediaAssetById(id)));
  assets.forEach((asset, index) => {
    const id = allIds[index];
    if (!asset || asset.status === "deleted") throw createHttpError(404, `Media asset ${id} not found.`);
    if (asset.ownerType !== "shop") throw createHttpError(403, `Media asset ${id} is not shop-owned media.`);
    if (asset.shopId !== shopId) throw createHttpError(403, `Media asset ${id} does not belong to your shop.`);
    if (asset.status !== "active") throw createHttpError(422, `Media asset ${id} is quarantined and cannot be attached.`);
    if (asset.moderationStatus === "rejected") throw createHttpError(422, `Media asset ${id} was rejected and cannot be attached.`);
  });

  const primaryAsset = primaryId ? assets.find((a, i) => allIds[i] === primaryId) : null;
  return { primaryId, galleryIds, primaryAsset };
}

function buildLinksForSelection(productId, shopId, { primaryId, galleryIds }) {
  const now = new Date().toISOString();
  const links = [];
  if (primaryId) links.push({ id: randomUUID(), productId, mediaAssetId: primaryId, shopId, role: "primary", position: 0, createdAt: now });
  galleryIds.filter((id) => id !== primaryId).forEach((id, index) => {
    links.push({ id: randomUUID(), productId, mediaAssetId: id, shopId, role: "gallery", position: index, createdAt: now });
  });
  return links;
}

/**
 * Commits a selection already validated by validateProductMediaSelection
 * -- replaces the product's links and mirrors the resolved primary's
 * card URL onto Product.imagePath. Never validates anything itself.
 *
 * Transactional (Task 5): if inserting the new links or mirroring
 * imagePath fails partway, the product's previous links/imagePath are
 * left completely untouched -- a real Mongo transaction in Mongo mode,
 * and a manual snapshot-and-restore in seed mode (which has no real
 * transactions at all).
 */
export async function commitProductMediaSelection(productId, shopId, selection, options = {}) {
  const { primaryAsset } = selection;
  const mirroredUrls = primaryAsset ? await resolveMediaUrls(primaryAsset.variants) : null;
  const nextImagePath = mirroredUrls?.card || mirroredUrls?.detail || null;
  const links = buildLinksForSelection(productId, shopId, selection);

  if (env.mongoUri) {
    if (options.session) {
      await ProductMediaLink.deleteMany({ productId }, { session: options.session });
      if (links.length) await ProductMediaLink.insertMany(links, { session: options.session });
      await Product.findOneAndUpdate({ id: productId }, { $set: { imagePath: nextImagePath } }, { session: options.session });
      return getProductMedia(productId);
    }
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await ProductMediaLink.deleteMany({ productId }, { session });
        if (links.length) await ProductMediaLink.insertMany(links, { session });
        await Product.findOneAndUpdate({ id: productId }, { $set: { imagePath: nextImagePath } }, { session });
      });
    } finally {
      await session.endSession();
    }
    return getProductMedia(productId);
  }

  const state = seedRepository.getState();
  const previousLinks = state.productMediaLinks.filter((l) => l.productId === productId).map((l) => ({ ...l }));
  const product = state.products.find((p) => p.id === productId);
  const previousImagePath = product ? product.imagePath : undefined;

  try {
    maybeThrowProductMediaFailure("before-delete");
    await deleteLinksForProduct(productId);
    maybeThrowProductMediaFailure("after-delete");
    await insertLinks(links);
    maybeThrowProductMediaFailure("after-insert");
    await setProductImagePath(productId, nextImagePath);
    maybeThrowProductMediaFailure("after-image-path");
  } catch (err) {
    // Roll back to exactly the pre-mutation state -- no real transaction
    // exists in seed mode, so this restore is the equivalent guarantee.
    state.productMediaLinks = state.productMediaLinks.filter((l) => l.productId !== productId);
    state.productMediaLinks.push(...previousLinks);
    if (product && previousImagePath !== undefined) product.imagePath = previousImagePath;
    throw err;
  }

  return getProductMedia(productId);
}

/**
 * Returns both the public-safe (filtered) media view and the raw link
 * state for a product.
 *
 * `primaryImage`/`images` are filtered to active, non-rejected assets
 * only -- the moment an already-linked asset is quarantined, rejected, or
 * deleted, it disappears from these fields on the very next read, with no
 * separate "unlink" step needed (nothing caches a resolved URL anywhere).
 *
 * `hasLinks` is the key to correct fallback behavior at the call sites in
 * marketplace.service.js/brandProfile.service.js: it's `true` as soon as
 * ANY ProductMediaLink row exists for this product, even if every linked
 * asset is currently invisible. Callers must use this -- not "is
 * primaryImage null?" -- to decide whether falling back to legacy
 * Product.imagePath is appropriate. Falling back on "primaryImage is
 * null" alone would resurrect a stale, no-longer-valid imagePath (set
 * once at link time and never updated) the instant the *currently* linked
 * image gets moderated, which defeats the whole point of moderation.
 *
 * `primaryMediaAssetId`/`galleryMediaAssetIds` are deliberately the RAW,
 * unfiltered link state (not filtered by visibility) -- seller/admin
 * product-edit forms use these to pre-populate the media picker, and they
 * need to keep showing a now-invisible reference (with its real status)
 * so the seller can see something's wrong and fix it, rather than the
 * picker silently forgetting a primary image was ever selected.
 */
export async function getProductMedia(productId) {
  const links = await listLinksForProduct(productId);
  const hasLinks = links.length > 0;
  if (!hasLinks) return { primaryImage: null, images: [], primaryMediaAssetId: null, galleryMediaAssetIds: [], hasLinks };

  const assets = await Promise.all(links.map((l) => findMediaAssetById(l.mediaAssetId)));
  const withAssets = links.map((link, i) => ({ link, asset: assets[i] }));
  const visible = withAssets.filter(({ asset }) => asset && asset.status === "active" && asset.moderationStatus !== "rejected");

  const primary = visible.find(({ link }) => link.role === "primary");
  const gallery = visible.filter(({ link }) => link.role !== "primary").sort((a, b) => a.link.position - b.link.position);
  const ordered = [...(primary ? [primary] : []), ...gallery];

  const urlsByAssetId = new Map();
  await Promise.all(ordered.map(async ({ asset }) => {
    if (!urlsByAssetId.has(asset.id)) urlsByAssetId.set(asset.id, await resolveMediaUrls(asset.variants));
  }));

  const rawPrimaryLink = links.find((l) => l.role === "primary");
  const rawGalleryLinks = links.filter((l) => l.role !== "primary").sort((a, b) => a.position - b.position);

  return {
    // { thumbnail, card, detail } or null -- ProductCard reads .card,
    // ProductDetailPage reads .detail, thumbnail strips read .thumbnail.
    // Filtered: only active, non-rejected assets ever appear here.
    primaryImage: primary ? urlsByAssetId.get(primary.asset.id) : null,
    images: ordered.map(({ asset }) => ({ ...urlsByAssetId.get(asset.id), altText: asset.altText || "" })),
    // Raw, unfiltered asset ids -- see doc comment above.
    primaryMediaAssetId: rawPrimaryLink?.mediaAssetId || null,
    galleryMediaAssetIds: rawGalleryLinks.map((l) => l.mediaAssetId),
    hasLinks,
  };
}

/**
 * Whether a product currently has a public-safe (active, non-rejected,
 * non-deleted) primary image -- either via a MediaAsset link or, for
 * never-migrated products, a non-empty legacy imagePath. Used to enforce
 * the "primary image required before submission/approval" rule (Task 4)
 * without duplicating the visibility logic that already lives in
 * getProductMedia/mergeProductMedia.
 */
export async function hasPublicSafePrimaryImage(productId, legacyImagePath) {
  const media = await getProductMedia(productId);
  if (media.hasLinks) return Boolean(media.primaryImage);
  return Boolean(legacyImagePath);
}

/** Batch loader for product list/serialization call sites. */
export async function getProductMediaForList(productIds) {
  const uniqueIds = [...new Set(productIds)];
  const results = await Promise.all(uniqueIds.map(async (id) => [id, await getProductMedia(id)]));
  return new Map(results);
}

/**
 * Verifies every id resolves to an active MediaAsset actually owned by
 * this specific owner (e.g. a driver reporting delivery-failure evidence)
 * -- never trusts a client-supplied mediaAssetId's ownership without a
 * database check. Throws (404/422) on any asset that's missing,
 * quarantined/rejected, or owned by someone else. Returns the deduped id
 * list on success.
 */
export async function assertOwnedMediaAssets(ownerType, ownerId, mediaAssetIds = []) {
  const uniqueIds = [...new Set(mediaAssetIds)].filter(Boolean);
  if (!uniqueIds.length) return uniqueIds;

  const assets = await Promise.all(uniqueIds.map((id) => findMediaAssetById(id)));
  assets.forEach((asset, index) => {
    const id = uniqueIds[index];
    if (!asset || asset.status === "deleted") throw createHttpError(404, `Evidence media ${id} not found.`);
    if (asset.ownerType !== ownerType || asset.ownerId !== ownerId) throw createHttpError(403, `Evidence media ${id} does not belong to this account.`);
    if (asset.status !== "active") throw createHttpError(422, `Evidence media ${id} is quarantined and cannot be used.`);
    if (asset.moderationStatus === "rejected") throw createHttpError(422, `Evidence media ${id} was rejected and cannot be used.`);
  });
  return uniqueIds;
}
