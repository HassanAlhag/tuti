import mongoose from "mongoose";

const sellerTransactionSchema = new mongoose.Schema(
  {
    id:      { type: String, required: true, unique: true },
    shopId:  { type: String, required: true, index: true },
    orderId: { type: String, required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: [
        "delivery_credit",   // order Delivered → pendingBalance += vendorNet
        "hold_release",      // hold period expired / admin released → pendingBalance → availableBalance
        "dispute_hold",      // customer dispute opened → pending|available → holdBalance
        "dispute_release",   // dispute resolved in seller's favour → holdBalance → availableBalance
        "refund_debit",      // refund approved → deduct from hold|available
        "cod_credit",        // COD cash settled by admin (Phase 2)
        "payout_debit",      // payout processed by admin (Phase 3)
      ],
    },
    // Amount is always positive; direction is implied by type.
    amount:    { type: Number, required: true, min: 0 },
    note:      { type: String, default: "" },
    createdBy: { type: String, default: "system" },
  },
  { timestamps: true }
);

// Idempotency guard: one ledger entry per (orderId, shopId, type).
// partialFilterExpression limits the unique index to documents where orderId is a non-null string,
// which keeps the door open for future types (e.g. payout_debit) that may use payoutId instead.
sellerTransactionSchema.index(
  { orderId: 1, shopId: 1, type: 1 },
  { unique: true, partialFilterExpression: { orderId: { $type: "string" } } }
);

export const SellerTransaction = mongoose.model("SellerTransaction", sellerTransactionSchema);
