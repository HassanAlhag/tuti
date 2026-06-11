import mongoose from "mongoose";

const shopSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    owner: { type: String, required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    city: { type: String, required: true },
    status: { type: String, enum: ["Approved", "Pending review", "Suspended", "Terminated"], default: "Pending review" },
    fulfillmentRate: { type: Number, default: 0 },
    disputeRate: { type: Number, default: 0 },
    serviceRating: { type: Number, default: 0 },
    payoutHoldDays: { type: Number, default: 7 },
    commissionRate: { type: Number, default: 14 },
    // ── Balance buckets ───────────────────────────────────────────────────────
    // pendingBalance:   earned but within the payout hold period (not yet withdrawable)
    // availableBalance: hold period expired or admin-released (ready for payout)
    // holdBalance:      frozen during an active dispute
    // paidBalance:      cumulative amount paid out (running total, never decrements)
    pendingBalance:   { type: Number, default: 0 },
    availableBalance: { type: Number, default: 0 },
    holdBalance:      { type: Number, default: 0 },
    paidBalance:      { type: Number, default: 0 },
    avatar: { type: String, default: "" },
    story: { type: String, default: "" },
    cover: { type: String, default: "" },
    category: { type: String, enum: ["perfume", "cake", "dessert", "gift_box", "mixed"], default: "mixed" },
    categories: [{ type: String, enum: ["perfume", "cake", "dessert", "gift_box", "mixed"] }],
    deliveryModel: { type: String, enum: ["seller_delivery", "pickup", "platform_later"], default: "seller_delivery" },
    onboardingStep: { type: String, default: "Admin review" },
    repCode: { type: String, default: "", uppercase: true, trim: true },
    repId: { type: mongoose.Schema.Types.ObjectId, ref: "SalesRep", default: null },
    acquisitionSource: { type: String, enum: ["organic", "sales_rep"], default: "organic" },
    adminNotices: [
      {
        id: { type: String, required: true },
        type: {
          type: String,
          enum: ["warning", "action_plan_request", "suspend", "reactivate", "terminate"],
          required: true,
        },
        note: { type: String, required: true, trim: true },
        deadline: { type: String, default: "" },
        issuedBy: { type: String, default: "admin" },
        issuedAt: { type: String, required: true },
        status: { type: String, enum: ["active", "acknowledged", "resolved", "submitted"], default: "active" },
        sellerPlan: { type: String, default: "" },
        sellerPlanAt: { type: String, default: "" },
      },
    ],
    contractStatus: { type: String, enum: ["Approved", "Pending review", "Suspended", "Terminated"], default: "Pending review" },
    contractTerminationReason: { type: String, default: "" },
    contractUpdatedAt: { type: String, default: "" },
    // ── Seller Application reference (read-only, set at conversion) ──
    sellerApplicationId:       { type: String, default: null },
    applicationContractStatus: { type: String, default: null },
    applicationConvertedAt:    { type: Date,   default: null },
    applicationBusinessName:   { type: String, default: null },
  },
  { timestamps: true }
);

export const Shop = mongoose.model("Shop", shopSchema);
