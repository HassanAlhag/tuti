import mongoose from "mongoose";

const commissionEntrySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    repId: { type: mongoose.Schema.Types.ObjectId, ref: "SalesRep", required: true },
    repCode: { type: String, required: true, uppercase: true, trim: true },
    referralId: { type: mongoose.Schema.Types.ObjectId, ref: "SellerReferral", default: null },
    shopId: { type: String, required: true, index: true },
    shopName: { type: String, default: "" },
    type: { type: String, enum: ["signup_bonus", "first_sale_bonus", "gmv_commission"], required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "AED" },
    status: { type: String, enum: ["Pending", "Confirmed", "Paid", "Reversed", "Paused"], default: "Pending" },
    orderId:     { type: String, default: null },
    note:        { type: String, default: "" },
    effectiveAt: { type: Date, default: Date.now },
    reversedAt: { type: Date, default: null },
    reversedReason: { type: String, default: "" },
    reversedOrderStatus: { type: String, default: "" },
  },
  { timestamps: true }
);

// Bonus dedup: one signup/first_sale bonus per referral.
// Partial filter excludes gmv_commission so repeated GMV entries are allowed.
commissionEntrySchema.index(
  { referralId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type:       { $in: ["signup_bonus", "first_sale_bonus"] },
      referralId: { $ne: null },
    },
  }
);
// GMV dedup: one GMV commission entry per order+shop.
// Sparse so bonus entries (orderId=null) are excluded from the constraint.
commissionEntrySchema.index({ orderId: 1, shopId: 1, type: 1 }, { unique: true, sparse: true });

export const CommissionEntry = mongoose.model("CommissionEntry", commissionEntrySchema);
