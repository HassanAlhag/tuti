import mongoose from "mongoose";

export const FEATURED_PRODUCT_PLACEMENT_KEYS = [
  "homepage_featured_products",
  "luxury_picks",
  "new_arrivals",
  "gift_sets",
  "arabic_perfumes",
  "seasonal_campaign",
];

const featuredProductPlacementSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, index: true, trim: true },
    shopId: { type: String, required: true, index: true, trim: true },
    placementKey: {
      type: String,
      required: true,
      index: true,
      enum: FEATURED_PRODUCT_PLACEMENT_KEYS,
      default: "homepage_featured_products",
      trim: true,
    },
    titleOverride: { type: String, default: "", trim: true },
    subtitleOverride: { type: String, default: "", trim: true },
    imageOverrideUrl: { type: String, default: "", trim: true },
    badgeLabel: { type: String, default: "", trim: true },
    priority: { type: Number, default: 0 },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
    createdBy: { type: String, default: "", trim: true },
    updatedBy: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

featuredProductPlacementSchema.index(
  { productId: 1, placementKey: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);
featuredProductPlacementSchema.index({ placementKey: 1, active: 1, priority: -1, createdAt: -1 });
featuredProductPlacementSchema.index({ shopId: 1 });

export const FeaturedProductPlacement = mongoose.model("FeaturedProductPlacement", featuredProductPlacementSchema);
