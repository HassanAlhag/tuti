import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    recipientRole: { type: String, enum: ["customer", "seller", "admin", "support", "driver"], required: true },
    recipientUserId: { type: String, default: null },
    shopId: { type: String, default: null },
    type: {
      type: String,
      required: true,
    },
    entityType: { type: String, enum: ["order", "product", "shop", "support", "commission", "delivery_offer", "system"], default: "system" },
    entityId: { type: String, default: "" },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ id: 1 }, { unique: true });
notificationSchema.index({ recipientUserId: 1, read: 1 });
notificationSchema.index({ recipientRole: 1, shopId: 1, read: 1 });
notificationSchema.index({ createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);
