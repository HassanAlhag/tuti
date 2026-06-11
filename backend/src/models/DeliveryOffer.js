import mongoose from "mongoose";

const deliveryOfferSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    orderId: { type: String, required: true, index: true },
    shopId: { type: String, required: true, index: true },
    shopName: { type: String, default: "" },
    sellerUserId: { type: String, default: null, index: true },
    deliveryZone: { type: String, default: "" },
    deliveryAddressSummary: { type: String, default: "" },
    codAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Open", "Accepted", "Expired", "Cancelled"],
      default: "Open",
      index: true,
    },
    offeredDriverIds: [{ type: String }],
    acceptedDriverId: { type: String, default: null, index: true },
    acceptedDriverName: { type: String, default: "" },
    acceptedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, index: true },
    createdBy: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

deliveryOfferSchema.index({ shopId: 1, status: 1, expiresAt: 1 });
deliveryOfferSchema.index({ shopId: 1, orderId: 1 });

export const DeliveryOffer = mongoose.model("DeliveryOffer", deliveryOfferSchema);
