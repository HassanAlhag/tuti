import mongoose from "mongoose";

/**
 * Per-shop COD cash ledger. A driver's Driver.codBalance/totalCodCollected
 * remain as a cached global-across-all-shops total (used by the admin
 * fleet-wide view), but any shop-scoped balance -- what a seller is
 * allowed to see -- must be computed from this collection, filtered by
 * shopId, never from the driver's global fields. See
 * modules/finance/driverCashLedger.js.
 *
 * One row per movement, never mutated after creation (a correction is a
 * new offsetting row, not an edit) -- `(orderId, type)` is unique so a
 * retry/reassignment on the same order can never double-record the same
 * collection or settlement.
 */
const driverCashTransactionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    driverId: { type: String, required: true },
    shopId: { type: String, required: true },
    orderId: { type: String, required: true },
    assignmentId: { type: String, default: null },
    type: {
      type: String,
      enum: ["cod_collected", "cod_remitted"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["pending_remittance", "settled"],
      default: "pending_remittance",
    },
    settlementRef: { type: String, default: null },
    recordedByUserId: { type: String, default: null },
  },
  { timestamps: true }
);

driverCashTransactionSchema.index({ orderId: 1, type: 1 }, { unique: true });
driverCashTransactionSchema.index({ driverId: 1, shopId: 1, status: 1 });
driverCashTransactionSchema.index({ shopId: 1, createdAt: -1 });

export const DriverCashTransaction = mongoose.model("DriverCashTransaction", driverCashTransactionSchema);
