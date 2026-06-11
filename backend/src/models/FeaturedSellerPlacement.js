import mongoose from "mongoose";

const featuredSellerPlacementSchema = new mongoose.Schema(
  {
    shopId: { type: String, required: true, index: true, trim: true },
    brandProfileId: { type: String, required: true, index: true, trim: true },
    placementKey: { type: String, required: true, index: true, default: "homepage_featured_sellers", trim: true },
    titleOverride: { type: String, default: "", trim: true },
    subtitleOverride: { type: String, default: "", trim: true },
    imageOverrideUrl: { type: String, default: "", trim: true },
    priority: { type: Number, default: 0 },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
    createdBy: { type: String, default: "", trim: true },
    updatedBy: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

featuredSellerPlacementSchema.index(
  { shopId: 1, placementKey: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);
featuredSellerPlacementSchema.index({ placementKey: 1, active: 1, priority: -1, createdAt: -1 });
featuredSellerPlacementSchema.index({ brandProfileId: 1 });

export const FeaturedSellerPlacement = mongoose.model("FeaturedSellerPlacement", featuredSellerPlacementSchema);
