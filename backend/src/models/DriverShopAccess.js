import mongoose from "mongoose";

/**
 * The single authoritative record of a driver-shop relationship. A driver
 * can hold many of these (one per shop); a shop can hold many (one per
 * driver). Nothing else in the codebase may treat a driver as
 * exclusively owned by one shop -- every eligibility check (broadcast,
 * offer-accept, direct assignment, retry/reassign/return-to-seller,
 * delivery completion) must go through
 * shared/driverShopAccess/assertDriverEligibleForShop.js, which reads
 * this collection, not Driver.shopId.
 *
 * `Driver.shopId` is kept temporarily for legacy/migration compatibility
 * only (see migrations/migrateDriverShopAccess.js) and must never be
 * read by new authorization code.
 */
const driverShopAccessSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    driverId: { type: String, required: true },
    shopId: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending_admin_approval", "active", "suspended", "rejected", "revoked"],
      default: "pending_admin_approval",
    },
    // Who/what originated the request -- lets the UI distinguish "your
    // shop asked for this driver" from "an admin attached this driver to
    // you directly" without inferring it from status alone.
    requestedByType: {
      type: String,
      enum: ["seller", "admin", "driver"],
      required: true,
    },
    requestedByUserId: { type: String, default: null },
    approvedByUserId: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" },
    suspendedAt: { type: Date, default: null },
    suspendedByUserId: { type: String, default: null },
    revokedAt: { type: Date, default: null },
    revokedByUserId: { type: String, default: null },
    serviceZoneIds: { type: [String], default: undefined },
    canReceiveBroadcasts: { type: Boolean, default: true },
    canBeDirectlyAssigned: { type: Boolean, default: true },
  },
  { timestamps: true }
);

driverShopAccessSchema.index({ driverId: 1, shopId: 1 }, { unique: true });
driverShopAccessSchema.index({ shopId: 1, status: 1 });
driverShopAccessSchema.index({ driverId: 1, status: 1 });

export const DriverShopAccess = mongoose.model("DriverShopAccess", driverShopAccessSchema);
