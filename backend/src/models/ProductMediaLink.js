import mongoose from "mongoose";

/**
 * Join collection between Product and MediaAsset, rather than an embedded
 * `Product.media` subdocument array. See docs in the Phase 2 delivery
 * report for the full rationale; summary:
 *   - A MediaAsset must be safely reusable across multiple products from
 *     the same shop (explicit requirement). Reuse is a many-to-many
 *     relationship, which an array embedded on Product cannot express
 *     without duplicating the asset's own fields (or a second lookup
 *     anyway) -- a join collection is the natural fit.
 *   - Reference-counting ("can this asset be deleted?") and orphan
 *     detection both become a single indexed query against this
 *     collection instead of a table-scan across every Product's embedded
 *     array.
 *   - Detaching an asset from one product (without deleting the asset)
 *     is a single link deletion, not a mutation of the Product document.
 */
const productMediaLinkSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    productId: { type: String, required: true },
    mediaAssetId: { type: String, required: true },
    shopId: { type: String, required: true }, // denormalized for fast ownership checks without a join
    role: { type: String, enum: ["primary", "gallery"], required: true },
    position: { type: Number, default: 0 }, // gallery ordering; primary is always shown first regardless
  },
  { timestamps: true }
);

// One row per (product, asset) pair -- reusing the same asset twice on one
// product is meaningless and would corrupt ordering/primary logic.
productMediaLinkSchema.index({ productId: 1, mediaAssetId: 1 }, { unique: true });
productMediaLinkSchema.index({ productId: 1, role: 1, position: 1 });
// Reference-count / orphan-detection lookups key off mediaAssetId alone.
productMediaLinkSchema.index({ mediaAssetId: 1 });

export const ProductMediaLink = mongoose.model("ProductMediaLink", productMediaLinkSchema);
