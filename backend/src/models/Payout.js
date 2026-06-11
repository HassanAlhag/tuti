import mongoose from "mongoose";

const PAYOUT_STATUSES = ["pending", "processing", "completed", "failed", "cancelled"];
const PAYOUT_METHODS  = ["bank_transfer", "wallet", "manual"];

const payoutSchema = new mongoose.Schema(
  {
    id:      { type: String, required: true, unique: true },
    shopId:  { type: String, required: true, index: true },
    // orderIds scoped to shopId — each orderId has a hold_release (or dispute_release)
    // that backs this payout.  Used as a lock: while status is pending/processing,
    // these orders cannot be included in another payout.
    orderIds: [{ type: String }],
    amount:   { type: Number, required: true, min: 0 },
    method:   { type: String, enum: PAYOUT_METHODS, default: "bank_transfer" },
    status:   { type: String, enum: PAYOUT_STATUSES, default: "pending", index: true },
    notes:         { type: String, default: "" },
    failureReason: { type: String, default: "" },
    createdBy:  { type: String, default: "" },        // admin sub who created
    processedBy: { type: String, default: "" },
    completedBy: { type: String, default: "" },
    cancelledBy: { type: String, default: "" },
    scheduledAt:  { type: Date, default: null },
    processedAt:  { type: Date, default: null },
    completedAt:  { type: Date, default: null },
    failedAt:     { type: Date, default: null },
    cancelledAt:  { type: Date, default: null },
  },
  { timestamps: true }
);

payoutSchema.index({ shopId: 1, status: 1 });

export const Payout = mongoose.model("Payout", payoutSchema);
