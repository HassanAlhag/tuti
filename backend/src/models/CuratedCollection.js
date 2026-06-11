import mongoose from "mongoose";

const collectionItemSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, enum: ["product", "seller"], trim: true },
    productId: { type: String, default: "", trim: true },
    shopId: { type: String, default: "", trim: true },
    brandProfileId: { type: String, default: "", trim: true },
    titleOverride: { type: String, default: "", trim: true },
    subtitleOverride: { type: String, default: "", trim: true },
    imageOverrideUrl: { type: String, default: "", trim: true },
    badgeLabel: { type: String, default: "", trim: true },
    priority: { type: Number, default: 0 },
  },
  { _id: false }
);

const curatedCollectionSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, index: true, trim: true },
    title: { type: String, default: "", trim: true },
    titleAr: { type: String, default: "", trim: true },
    subtitle: { type: String, default: "", trim: true },
    subtitleAr: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    descriptionAr: { type: String, default: "", trim: true },
    bannerUrl: { type: String, default: "", trim: true },
    mobileBannerUrl: { type: String, default: "", trim: true },
    placementKey: { type: String, default: "", trim: true, index: true },
    theme: { type: String, default: "", trim: true },
    priority: { type: Number, default: 0 },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    active: { type: Boolean, default: true, index: true },
    published: { type: Boolean, default: false, index: true },
    items: { type: [collectionItemSchema], default: [] },
    createdBy: { type: String, default: "", trim: true },
    updatedBy: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

curatedCollectionSchema.index({ active: 1, published: 1, priority: -1, createdAt: -1 });
curatedCollectionSchema.index({ slug: 1 }, { unique: true });

export const CuratedCollection = mongoose.model("CuratedCollection", curatedCollectionSchema);
