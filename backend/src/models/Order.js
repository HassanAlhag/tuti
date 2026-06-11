import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    shopId: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    category: { type: String, default: "" },
    family: { type: String, default: "" },
    gender: { type: String, default: "" },
    size: { type: String, default: "" },
    cakeType: { type: String, default: "" },
    flavors: [{ type: String }],
    servings: { type: String, default: "" },
    allergens: [{ type: String }],
    leadTimeDays: { type: Number, min: 0 },
    bundledProductIds: [{ type: String }],
    includes: [{ type: String }],
    occasionTags: [{ type: String }],
    metadata: { type: mongoose.Schema.Types.Mixed, default: undefined },
    configuration: { type: mongoose.Schema.Types.Mixed, default: undefined },
  },
  { _id: false }
);

const statusHistoryEntrySchema = new mongoose.Schema(
  {
    from:       { type: String, default: null },
    to:         { type: String, required: true },
    by:         { type: String, default: "system" },
    role:       { type: String, default: "system" },
    note:       { type: String, default: null },
    courierRef: { type: String, default: null },
    timestamp:  { type: Date, default: Date.now },
  },
  { _id: false }
);

const supportCaseNoteSchema = new mongoose.Schema(
  {
    note: { type: String, required: true },
    by: { type: String, default: "system" },
    role: { type: String, default: "system" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const supportCaseSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["dispute", "support"],
      default: "dispute",
    },
    issueType: { type: String, default: null },
    status: {
      type: String,
      enum: [
        "open",
        "under_review",
        "waiting_customer",
        "waiting_seller",
        "waiting_driver",
        "escalated",
        "resolved",
        "rejected",
        "closed",
      ],
      default: "open",
    },
    priority: {
      type: String,
      enum: ["normal", "high", "urgent"],
      default: "normal",
    },
    sourceSupportTicketId: { type: String, default: null },
    sourceSupportTicketNumber: { type: String, default: null },
    convertedAt: { type: Date, default: null },
    convertedBy: { type: String, default: null },
    convertedByRole: { type: String, default: null },
    conversionNote: { type: String, default: null },
    internalNotes: [supportCaseNoteSchema],
    lastActionAt: { type: Date, default: null },
    escalatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const resolutionDecisionSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["open", "decided", "executed", "reversed"],
      default: "open",
    },
    liability: {
      type: String,
      enum: ["seller_fault", "customer_fault", "mixed", "inconclusive", null],
      default: null,
    },
    refundDecision: {
      type: String,
      enum: ["none", "required", "goodwill", null],
      default: null,
    },
    payoutDecision: {
      type: String,
      enum: ["hold", "release_approved", "clawback_planned", null],
      default: null,
    },
    orderDecision: {
      type: String,
      enum: ["keep_order", "cancel_order", null],
      default: null,
    },
    codResolution: {
      type: String,
      enum: ["no_cash_collected", "seller_to_refund_cash", "platform_to_refund_cash", "no_refund_due", null],
      default: null,
    },
    decisionNote: { type: String, default: "" },
    decidedBy: { type: String, default: "" },
    decidedRole: { type: String, default: "" },
    decidedAt: { type: Date, default: null },
    executedBy: { type: String, default: "" },
    executedRole: { type: String, default: "" },
    executedAt: { type: Date, default: null },
    requiresFollowUp: { type: Boolean, default: false },
    followUpBy: { type: Date, default: null },
    gatewayProvider: { type: String, default: null },
    gatewayRefundIntentId: { type: String, default: null },
    gatewayRefundStatus: { type: String, default: null },
  },
  { _id: false }
);

const driverAssignmentSchema = new mongoose.Schema(
  {
    driverId:     { type: String, required: true },
    driverName:   { type: String, default: "" },
    driverPhone:  { type: String, default: "" },
    assignedAt:   { type: Date, default: Date.now },
    deliveredAt:  { type: Date, default: null },
    codCollected: { type: Boolean, default: false },
    codAmount:    { type: Number, default: 0 },
    note:         { type: String, default: "" },
    // ── COD settlement markers (set by admin during cash reconciliation) ──
    codSettledAt:      { type: Date,   default: null },
    codSettledBy:      { type: String, default: null },
    codSettlementRef:  { type: String, default: null },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },
    customerId: { type: String, default: null },
    checkoutMode: {
      type: String,
      enum: ["guest", "account"],
      default: "guest",
    },
    paymentMethod: {
      type: String,
      enum: ["card", "cod"],
      default: "card",
    },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    phone: { type: String, default: "" },
    items: [orderItemSchema],
    subtotal: { type: Number, required: true },
    platformFee: { type: Number, required: true },
    vendorNet: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Processing", "Ready for Delivery", "Shipped", "Delivered", "Customer Accepted", "Cancelled", "Refunded", "Disputed"],
      default: "Pending",
    },
    paymentStatus: {
      type: String,
      enum: [
        "Authorization",
        "Captured",
        "Escrow",
        "Payout hold",
        "Ready for payout",
        "Dispute hold",
        "Released",
        "Refunded",
        "COD pending",
        "COD collected",
      ],
      default: "Authorization",
    },
    deliveryAddress: { type: String, default: "" },
    deliveryDate: { type: String, default: "" },
    deliveryTime: { type: String, default: "" },
    giftMessage: { type: String, default: "" },
    notes: { type: String, default: "" },
    shopIds:            [{ type: String }],
    statusHistory:      [statusHistoryEntrySchema],
    customerResponse:   { type: mongoose.Schema.Types.Mixed, default: undefined },
    cancellationReason: { type: String, default: null },
    supportCase:        { type: supportCaseSchema, default: undefined },
    resolutionDecision: { type: resolutionDecisionSchema, default: undefined },
    driverAssignment:   { type: driverAssignmentSchema, default: undefined },
    // Idempotency key — supplied by client per checkout attempt; sparse unique so null orders coexist
    idempotencyKey:     { type: String, default: null },
    // Fingerprint of items+email for detecting changed-payload conflicts on duplicate key
    requestFingerprint: { type: String, default: null },
    // SHA-256 hash of the raw guest confirmation token; null for authenticated orders
    guestConfirmationToken: { type: String, default: null },
  },
  { timestamps: true }
);

orderSchema.index({ customerId: 1 });
orderSchema.index({ shopIds: 1 });
orderSchema.index({ status: 1 });
// Sparse unique index: allows multiple null values while enforcing uniqueness for set keys
orderSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
orderSchema.index({ guestConfirmationToken: 1 }, { sparse: true });

export const Order = mongoose.model("Order", orderSchema);
