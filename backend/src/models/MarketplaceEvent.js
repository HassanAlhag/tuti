import mongoose from "mongoose";

export const MARKETPLACE_EVENT_TYPES = [
  "product_view",
  "product_click",
  "seller_brand_view",
  "collection_view",
  "placement_impression",
  "placement_click",
];

export const MARKETPLACE_EVENT_SOURCES = [
  "web_homepage",
  "web_product_page",
  "web_seller_brand_page",
  "web_collection_page",
  "seller_portal",
  "admin_portal",
];

export const MARKETPLACE_EVENT_PLACEMENT_TYPES = [
  "homepage_rail",
  "product_card",
  "seller_card",
  "collection_card",
  "brand_page",
  "collection_page",
  "product_page",
];

const marketplaceEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: true,
      enum: MARKETPLACE_EVENT_TYPES,
      trim: true,
    },
    occurredAt: {
      type: Date,
      required: true,
      index: true,
    },
    sessionId: { type: String, default: null, trim: true, index: true },
    anonymousId: { type: String, default: null, trim: true, index: true },
    userId: { type: String, default: null, trim: true, index: true },
    userRole: { type: String, default: null, trim: true, index: true },
    shopId: { type: String, default: null, trim: true, index: true },
    sellerShopId: { type: String, default: null, trim: true, index: true },
    productId: { type: String, default: null, trim: true, index: true },
    collectionId: { type: String, default: null, trim: true, index: true },
    placementId: { type: String, default: null, trim: true, index: true },
    placementType: {
      type: String,
      default: null,
      trim: true,
      enum: [...MARKETPLACE_EVENT_PLACEMENT_TYPES, null],
    },
    placementKey: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
      maxlength: 80,
      index: true,
    },
    source: {
      type: String,
      required: true,
      enum: MARKETPLACE_EVENT_SOURCES,
      trim: true,
    },
    route: { type: String, required: true, trim: true, maxlength: 200 },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, minimize: false }
);

marketplaceEventSchema.index({ eventType: 1, occurredAt: -1 });
marketplaceEventSchema.index({ source: 1, occurredAt: -1 });
marketplaceEventSchema.index({ placementKey: 1, placementType: 1, occurredAt: -1 });
marketplaceEventSchema.index({ shopId: 1, sellerShopId: 1, occurredAt: -1 });
marketplaceEventSchema.index({ productId: 1, occurredAt: -1 });
marketplaceEventSchema.index({ collectionId: 1, occurredAt: -1 });

export const MarketplaceEvent = mongoose.model("MarketplaceEvent", marketplaceEventSchema);
