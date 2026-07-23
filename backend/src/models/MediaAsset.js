import mongoose from "mongoose";

/**
 * A single uploaded image. Ownership is always resolved server-side at
 * upload time (never from client-supplied ownerId/shopId -- see
 * shared/mediaStorage.js and the /api/upload route) and never changes
 * after creation.
 *
 * The original upload buffer is never stored -- only the three optimized
 * WebP variants (thumbnail/card/detail) produced by Sharp, each uploaded
 * to S3 under its own key. `variants.*.storageKey` is the only pointer to
 * S3; public URLs are resolved at serialization time from
 * AWS_CLOUDFRONT_DOMAIN (or a short-lived presigned URL in local/test
 * mode) -- see shared/s3Storage.js -- so nothing here hardcodes a
 * permanent S3 URL.
 *
 * width/height are the ORIGINAL image's dimensions (EXIF-orientation
 * corrected), recorded for display/QA purposes; each variant additionally
 * records its own generated width/height/sizeBytes.
 *
 * status vs moderationStatus are deliberately separate:
 *   - status governs the file's own lifecycle (active / quarantined /
 *     deleted-but-record-kept for audit).
 *   - moderationStatus is an admin review signal on top of an active file;
 *     it does not gate product approval in this phase (product approval
 *     remains the primary moderation boundary) but a "rejected" or
 *     "quarantined" asset cannot be newly attached to a product and stops
 *     rendering on public surfaces.
 */
const mediaVariantSchema = new mongoose.Schema(
  {
    storageKey: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    sizeBytes: { type: Number, required: true },
  },
  { _id: false }
);

const mediaAssetSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },

    ownerType: { type: String, enum: ["shop", "admin", "driver"], required: true },
    // shopId is the source of truth for shop-owned media authorization
    // (matches req.ownedShopId). ownerId additionally records the specific
    // uploading identity (shop id / "admin" / driverId) for audit purposes
    // and is redundant with shopId for ownerType:"shop" by design.
    ownerId: { type: String, required: true },
    shopId: { type: String, default: null },

    uploadedByUserId: { type: String, default: null },
    uploadedByRole: { type: String, enum: ["seller", "admin", "driver"], required: true },

    storageProvider: { type: String, enum: ["local", "s3"], required: true },
    variants: {
      thumbnail: { type: mediaVariantSchema, required: true },
      card: { type: mediaVariantSchema, required: true },
      detail: { type: mediaVariantSchema, required: true },
    },

    originalFilename: { type: String, default: "" },
    mimeType: { type: String, required: true }, // original upload format (image/jpeg|png|webp); stored variants are always image/webp
    width: { type: Number, default: null }, // original, EXIF-orientation-corrected
    height: { type: Number, default: null },
    checksum: { type: String, required: true }, // sha256 of the original upload buffer -- internal dedupe use only, never returned via API

    altText: { type: String, default: "", trim: true, maxlength: 200 },
    caption: { type: String, default: "", trim: true, maxlength: 400 },

    status: { type: String, enum: ["active", "quarantined", "deleted"], default: "active" },
    moderationStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  },
  { timestamps: true }
);

mediaAssetSchema.index({ shopId: 1, createdAt: -1 });
mediaAssetSchema.index({ ownerType: 1, createdAt: -1 });
mediaAssetSchema.index({ checksum: 1, shopId: 1 });

export const MediaAsset = mongoose.model("MediaAsset", mediaAssetSchema);
