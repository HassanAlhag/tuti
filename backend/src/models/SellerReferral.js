import mongoose from "mongoose";

const sellerReferralSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    repId: { type: mongoose.Schema.Types.ObjectId, ref: "SalesRep", required: true },
    repCode: { type: String, required: true, uppercase: true, trim: true },
    shopId: { type: String, required: true },
    shopName: { type: String, default: "" },
    sellerUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status:      { type: String, enum: ["pending_approval", "active", "inactive"], default: "pending_approval" },
    approvedAt:  { type: Date, default: null },
    firstSaleAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One referral per shop — prevents duplicates if registration is retried.
sellerReferralSchema.index({ shopId: 1 }, { unique: true });

export const SellerReferral = mongoose.model("SellerReferral", sellerReferralSchema);
