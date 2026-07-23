/**
 * Product media persistence orchestration: multer buffers the raw upload
 * in memory, imageOptimizer.js (Sharp) validates it and produces
 * thumbnail/card/detail WebP variants, and s3Storage.js persists each
 * variant to S3 (or local disk in dev/test -- see s3Storage.js's
 * fail-closed production check).
 *
 * optimizeAndPersistImage() is the single entry point media.service.js
 * calls for an upload. If any variant fails to upload partway through,
 * every variant already uploaded for this assetId is deleted before the
 * error propagates -- callers must never create a MediaAsset record from
 * a partial result (see Task 9 / the delivery report's S3 cleanup notes).
 */

import { createHash } from "node:crypto";
import multer from "multer";
import { optimizeImage, ALLOWED_INPUT_MIME_TYPES, MAX_UPLOAD_BYTES, RECOMMENDED_MIN_WIDTH, RECOMMENDED_MIN_HEIGHT } from "./imageOptimizer.js";
import { putVariant, deleteVariants, resolveVariantUrl, buildVariantStorageKey, getStorageMode } from "./s3Storage.js";
import { logger } from "./logger.js";

export { MAX_UPLOAD_BYTES, RECOMMENDED_MIN_WIDTH, RECOMMENDED_MIN_HEIGHT };
export const ALLOWED_MIME_TYPES = ALLOWED_INPUT_MIME_TYPES;

const VARIANT_NAMES = ["thumbnail", "card", "detail"];

export function createUploadMulter() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_BYTES },
    fileFilter: (_req, file, cb) => {
      // Cheap first-pass rejection based on the client's declared
      // Content-Type. optimizeImage() re-checks the real file signature
      // against the buffer itself -- this claim is never trusted alone.
      if (ALLOWED_INPUT_MIME_TYPES.has(file.mimetype)) return cb(null, true);
      cb(new Error("Only JPEG, PNG, and WebP images are accepted."));
    },
  });
}

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Only used for the human-readable originalFilename field -- never used to build a storage path (storage keys are always assetId-based, resolved server-side). */
export function sanitizeOriginalFilename(originalname) {
  return String(originalname || "").replace(/[/\\]/g, "_").slice(-180);
}

/**
 * Validates + optimizes `buffer` into 3 WebP variants and uploads each to
 * S3/local disk under an ownership-namespaced key
 * (shops/{shopId}/media/{assetId}/{variant}.webp, etc -- see
 * buildVariantStorageKey). Ownership (ownerType/ownerId) must already be
 * resolved by the caller from verified server-side identity -- never from
 * client input.
 *
 * On partial upload failure, deletes whatever variants for this assetId
 * did make it to storage before rethrowing a controlled 502 -- the caller
 * must never create a MediaAsset record from the partial result.
 */
export async function optimizeAndPersistImage({ buffer, ownerType, ownerId, assetId, uploadedByUserId, uploadsDir }) {
  const { format, originalWidth, originalHeight, variants } = await optimizeImage(buffer);

  const uploadedKeys = [];
  const variantResult = {};
  try {
    for (const name of VARIANT_NAMES) {
      const storageKey = buildVariantStorageKey({ ownerType, ownerId, assetId, variant: name });
      await putVariant({
        storageKey,
        buffer: variants[name].buffer,
        metadata: {
          assetId,
          shopId: ownerType === "shop" ? ownerId : "",
          uploadedBy: uploadedByUserId || "",
          variant: name,
        },
        uploadsDir,
      });
      uploadedKeys.push(storageKey);
      variantResult[name] = { storageKey, width: variants[name].width, height: variants[name].height, sizeBytes: variants[name].sizeBytes };
    }
  } catch (err) {
    if (uploadedKeys.length) {
      const cleanup = await deleteVariants(uploadedKeys, { uploadsDir });
      if (cleanup.failed.length) {
        logger.error({ assetId, failed: cleanup.failed }, "[media] Cleanup after partial upload failure left orphaned variants");
      }
    }
    logger.error({ assetId, err: err.message }, "[media] Variant upload failed, upload rolled back");
    const error = new Error("Could not store the optimized image. Please try again.");
    error.status = 502;
    throw error;
  }

  return { format, storageProvider: getStorageMode(), originalWidth, originalHeight, variants: variantResult };
}

/** Resolves { thumbnail, card, detail } URLs for a MediaAsset's stored variants. */
export async function resolveMediaUrls(variants) {
  if (!variants) return { thumbnail: null, card: null, detail: null };
  const [thumbnail, card, detail] = await Promise.all(
    VARIANT_NAMES.map((name) => resolveVariantUrl(variants[name]?.storageKey))
  );
  return { thumbnail, card, detail };
}

/**
 * Deletes every stored variant for a MediaAsset. Used both by "delete
 * unreferenced asset" (seller/admin) and by the upload-failure/DB-failure
 * cleanup paths above. Never throws -- returns { deleted, failed } so
 * callers can log/proceed regardless (see Task 9: partial S3 deletion
 * failure must not block the caller).
 */
export async function deleteMediaVariants(variants, { uploadsDir } = {}) {
  const keys = VARIANT_NAMES.map((name) => variants?.[name]?.storageKey).filter(Boolean);
  return deleteVariants(keys, { uploadsDir });
}
