import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    shopId: { type: String, required: true },

    // ── Universal fields
    category: {
      type: String,
      enum: ["perfume", "cake", "dessert", "gift_box", "bundle"],
      default: "perfume",
    },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["Live", "Needs approval", "Rejected", "Draft"],
      default: "Needs approval",
    },
    tags: [{ type: String }],
    occasionTags: [{ type: String }],
    releaseType: { type: String, default: "New Release" },
    collection: { type: String, default: "" },
    color: { type: String, default: "#52796f" },
    accent: { type: String, default: "#e9c46a" },
    imagePath: { type: String, default: null },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviews: { type: Number, default: 0 },
    orders: { type: Number, default: 0 },
    verifiedReviews: { type: Number, default: 0 },

    // ── Perfume-specific
    family: { type: String, enum: ["Oud", "Floral", "Fresh", "Musk", "Amber", ""], default: "" },
    gender: { type: String, enum: ["Unisex", "Men", "Women", ""], default: "" },
    notes: [{ type: String }],
    notePyramid: {
      top: [{ type: String }],
      heart: [{ type: String }],
      base: [{ type: String }],
    },
    occasion: [{ type: String }],
    intensity: { type: String, default: "" },
    longevity: { type: String, default: "" },
    description: { type: String, default: "" },
    ingredients: [{ type: String }],
    howToUse: { type: String, default: "" },
    deliveryReturns: { type: String, default: "" },
    size: { type: String, default: "" },

    // ── Cake / dessert-specific
    cakeType: { type: String, default: "" },
    flavors: [{ type: String }],
    servings: { type: String, default: "" },
    allergens: [{ type: String }],
    leadTimeDays: { type: Number, default: 1 },
    customMessageAvailable: { type: Boolean, default: false },

    // ── Gift box / bundle-specific
    bundledProductIds: [{ type: String }],
    includes: [{ type: String }],

    // ── Edit tracking
    sellerLastEditedAt: { type: Date, default: null },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

productSchema.index({ name: "text", notes: "text", tags: "text", family: "text" });

export const Product = mongoose.model("Product", productSchema);
