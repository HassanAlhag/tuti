import mongoose from "mongoose";

const driverSchema = new mongoose.Schema(
  {
    id:                { type: String, required: true, unique: true },
    name:              { type: String, required: true, trim: true },
    phone:             { type: String, required: true },
    email:             { type: String, default: "", lowercase: true, trim: true },
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
