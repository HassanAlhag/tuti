import mongoose from "mongoose";

const APPLICATION_STAGES = [
  "Submitted",
  "Contacted",
  "Documents Requested",
  "Terms Negotiation",
  "Agreement Sent",
  "Agreement Signed",
  "Approved for Onboarding",
  "Converted to Seller",
  "Rejected",
  "Paused",
];

const CONTRACT_STATUSES = [
  "Not Started",
  "Drafting",
  "Sent",
  "Signed",
  "Expired",
  "Cancelled",
];

const CHECKLIST_KEYS = [
  "businessProof",
  "ownerId",
  "productSamples",
  "priceList",
  "deliveryCoverage",
  "codAgreement",
  "returnRefundTerms",
  "commissionAgreement",
  "payoutTerms",
  "contractSigned",
  "adminApproval",
];

const checklistItemSchema = new mongoose.Schema(
  {
    completed:   { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    completedBy: { type: String, default: "" },
    note:        { type: String, default: "" },
  },
  { _id: false }
);

function emptyChecklist() {
  return Object.fromEntries(CHECKLIST_KEYS.map((key) => [key, {
    completed:   false,
    completedAt: null,
    completedBy: "",
    note:        "",
  }]));
}

// Build checklist schema dynamically from CHECKLIST_KEYS
const checklistSchema = new mongoose.Schema(
  Object.fromEntries(CHECKLIST_KEYS.map((key) => [key, { type: checklistItemSchema, default: () => ({}) }])),
  { _id: false }
);

const noteSchema = new mongoose.Schema(
  {
    id:          { type: String, required: true },
    type: {
      type: String,
      enum: ["Note", "Call", "Email", "Follow-up", "Contract", "Document", "Risk"],
      default: "Note",
    },
    text:        { type: String, required: true, maxlength: 2000 },
    createdBy:   { type: String, default: "admin" },
    createdRole: { type: String, default: "admin" },
  },
  { _id: false, timestamps: true }
);

const documentSchema = new mongoose.Schema(
  {
    id:         { type: String, required: true },
    type:       { type: String, default: "" },
    name:       { type: String, default: "" },
    url:        { type: String, default: "" },
    status: {
      type: String,
      enum: ["Requested", "Received", "Approved", "Rejected"],
      default: "Requested",
    },
    note:       { type: String, default: "" },
    uploadedAt: { type: Date, default: null },
  },
  { _id: false }
);

const sellerApplicationSchema = new mongoose.Schema(
  {
    id:                   { type: String, required: true, unique: true },

    // ── Applicant info ─────────────────────────────────────────────
    businessName:         { type: String, required: true, trim: true, maxlength: 120 },
    contactName:          { type: String, required: true, trim: true, maxlength: 100 },
    email:                { type: String, default: "", lowercase: true, trim: true },
    phone:                { type: String, default: "" },
    whatsapp:             { type: String, default: "" },
    city:                 { type: String, required: true, trim: true },
    area:                 { type: String, default: "" },
    category: {
      type: String,
      enum: ["perfume", "cake", "dessert", "gift_box", "mixed", "other"],
      required: true,
      default: "mixed",
    },
    instagram:            { type: String, default: "" },
    website:              { type: String, default: "" },
    expectedProductCount: { type: Number, default: 0 },

    // ── Commercial terms ───────────────────────────────────────────
    deliveryMethod: {
      type: String,
      enum: ["seller_delivery", "pickup", "platform_later", ""],
      default: "",
    },
    codHandling:           { type: String, default: "" },
    commissionPlan:        { type: String, default: "" },
    proposedCommissionRate:{ type: Number, default: null },
    payoutTerms:           { type: String, default: "" },

    // ── Pipeline state ─────────────────────────────────────────────
    applicationStage: {
      type: String,
      enum: APPLICATION_STAGES,
      default: "Submitted",
    },
    contractStatus: {
      type: String,
      enum: CONTRACT_STATUSES,
      default: "Not Started",
    },
    riskLevel: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Low",
    },

    // ── Assignment / attribution ───────────────────────────────────
    assignedTo:    { type: String, default: "" },
    salesRepCode:  { type: String, default: "" },
    nextFollowUpAt:{ type: Date, default: null },

    // ── Structured data ────────────────────────────────────────────
    checklist:  { type: checklistSchema, default: emptyChecklist },
    documents:  [documentSchema],
    notes:      [noteSchema],

    // ── Conversion tracking ────────────────────────────────────────
    convertedUserId: { type: String, default: null },
    convertedShopId: { type: String, default: null },
    convertedAt:     { type: Date, default: null },
  },
  { timestamps: true }
);

sellerApplicationSchema.index({ applicationStage: 1 });
sellerApplicationSchema.index({ email: 1 });
sellerApplicationSchema.index({ city: 1 });

export { APPLICATION_STAGES, CONTRACT_STATUSES, CHECKLIST_KEYS, emptyChecklist };
export const SellerApplication = mongoose.model("SellerApplication", sellerApplicationSchema);
