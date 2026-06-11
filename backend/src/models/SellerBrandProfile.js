import mongoose from "mongoose";

const sellerPolicySchema = new mongoose.Schema(
  {
    label: { type: String, default: "", trim: true },
    value: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const socialLinkSchema = new mongoose.Schema(
  {
    label: { type: String, default: "", trim: true },
    url: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const sellerBrandProfileSchema = new mongoose.Schema(
  {
    shopId: { type: String, required: true, unique: true, index: true },
    slug: { type: String, required: true, unique: true, index: true, trim: true },
    displayName: { type: String, default: "", trim: true },
    displayNameAr: { type: String, default: "", trim: true },
    shortTagline: { type: String, default: "", trim: true },
    shortTaglineAr: { type: String, default: "", trim: true },
    brandStory: { type: String, default: "", trim: true },
    brandStoryAr: { type: String, default: "", trim: true },
    logoUrl: { type: String, default: "", trim: true },
    bannerUrl: { type: String, default: "", trim: true },
    fragranceIdentityTags: [{ type: String, trim: true }],
    specialties: [{ type: String, trim: true }],
    trustBadges: [{ type: String, trim: true }],
    sellerPolicies: { type: [sellerPolicySchema], default: [] },
    socialLinks: { type: [socialLinkSchema], default: [] },
    published: { type: Boolean, default: false },
    completenessScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

sellerBrandProfileSchema.index({ shopId: 1 }, { unique: true });
sellerBrandProfileSchema.index({ slug: 1 }, { unique: true });

export const SellerBrandProfile = mongoose.model("SellerBrandProfile", sellerBrandProfileSchema);
