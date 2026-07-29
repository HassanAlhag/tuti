import mongoose from "mongoose";

const driverSchema = new mongoose.Schema(
  {
    id:                { type: String, required: true, unique: true },
    name:              { type: String, required: true, trim: true },
    phone:             { type: String, required: true },
    email:             { type: String, default: "", lowercase: true, trim: true },
    // Digits-only phone / lowercased email, computed at write time --
    // exact-match dedup lookups (shared/normalizeContact.js) query these
    // instead of doing a fuzzy scan over the raw, inconsistently-formatted
    // `phone`/`email` fields. See modules/drivers/driverDirectory.js.
    normalizedPhone:   { type: String, default: "", index: true },
    normalizedEmail:   { type: String, default: "", index: true },
    // Legacy single-shop ownership -- kept only for migration
    // compatibility (see tools/migrateDriverShopAccess.js). New
    // authorization code must never read this; use DriverShopAccess.
    shopId:            { type: String, default: null, index: true },
    shopName:          { type: String, default: "" },
    createdBySellerUserId: { type: String, default: null },
    userId:            { type: String, default: null, index: true },
    loginEnabled:      { type: Boolean, default: false },
    loginEmail:        { type: String, default: "", lowercase: true, trim: true },
    vehicleType: {
      type: String,
      enum: ["motorcycle", "car", "van"],
      default: "motorcycle",
    },
    zone:              { type: String, default: "" },
    status: {
      type: String,
      enum: ["active", "inactive", "on_delivery"],
      default: "active",
    },
    codBalance:        { type: Number, default: 0 },
    totalDeliveries:   { type: Number, default: 0 },
    totalCodCollected: { type: Number, default: 0 },
    isActive:          { type: Boolean, default: true },
  },
  { timestamps: true }
);

driverSchema.index({ status: 1 });
driverSchema.index({ shopId: 1 });

export const Driver = mongoose.model("Driver", driverSchema);
