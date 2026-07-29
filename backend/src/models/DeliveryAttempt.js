import mongoose from "mongoose";
import { DELIVERY_FAILURE_REASON_CODES, VALID_NEXT_ACTIONS } from "../shared/deliveryFailurePolicy.js";

/**
 * Immutable per-attempt delivery event -- one row per driver delivery
 * attempt (failed or delivered), never updated after creation. This is
 * the audit trail the "delivery failed" workflow depends on: unlike
 * Order.statusHistory (a generic, unconstrained log of status changes),
 * this collection has a real unique constraint per (orderId,
 * attemptNumber), so attempt numbering can never collide or be
 * double-counted, and it's queryable independently of the order document.
 *
 * Deliberately does NOT store secrets or unnecessary customer PII --
 * only what's needed to explain what happened on this attempt (reason,
 * note, evidence references, contact-attempt count).
 */
const deliveryAttemptSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    orderId: { type: String, required: true },
    assignmentId: { type: String, required: true },
    driverId: { type: String, required: true },
    shopId: { type: String, required: true },
    attemptNumber: { type: Number, required: true, min: 1 },
    result: { type: String, enum: ["failed", "delivered"], required: true },
    reasonCode: { type: String, enum: [...DELIVERY_FAILURE_REASON_CODES, null], default: null },
    note: { type: String, default: "", maxlength: 1000 },
    customerReached: { type: Boolean, default: false },
    contactAttempts: { type: Number, default: 0, min: 0, max: 20 },
    requestedRetryAt: { type: Date, default: null },
    evidenceMediaAssetIds: [{ type: String }],
    nextAction: { type: String, enum: [...VALID_NEXT_ACTIONS, null], default: null },
    occurredAt: { type: Date, default: Date.now },
    createdBy: { type: String, required: true },
    createdByRole: { type: String, default: "driver" },
  },
  { timestamps: true }
);

deliveryAttemptSchema.index({ orderId: 1, attemptNumber: 1 }, { unique: true });
deliveryAttemptSchema.index({ assignmentId: 1 });
deliveryAttemptSchema.index({ driverId: 1, createdAt: -1 });
deliveryAttemptSchema.index({ shopId: 1, createdAt: -1 });

export const DeliveryAttempt = mongoose.model("DeliveryAttempt", deliveryAttemptSchema);
