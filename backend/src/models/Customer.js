import mongoose from "mongoose";

const crmNoteSchema = new mongoose.Schema(
  {
    id:        { type: String, required: true },
    text:      { type: String, required: true, maxlength: 1000 },
    type: {
      type: String,
      enum: ["note", "call", "email", "follow_up", "complaint", "compliment"],
      default: "note",
    },
    by:   { type: String, default: "admin" },
    role: { type: String, default: "admin" },
  },
  { _id: false, timestamps: true }
);

const customerSchema = new mongoose.Schema(
  {
    id:                  { type: String, required: true, unique: true },
    name:                { type: String, required: true, trim: true },
    email:               { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone:               { type: String, default: "" },
    city:                { type: String, default: "" },
    segment:             { type: String, default: "Marketplace buyer" },
    status: {
      type: String,
      enum: ["Active", "VIP", "Inactive", "Blocked"],
      default: "Active",
    },
    risk: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Low",
    },
    loyaltyPoints:        { type: Number, default: 0 },
    lifetimeValue:        { type: Number, default: 0 },
    orders:               { type: Number, default: 0 },
    avgOrderValue:        { type: Number, default: 0 },
    lastOrderAt:          { type: String, default: null },
    preferredCategories:  [{ type: String }],
    savedOccasions:       [{ type: String }],
    favoriteShopIds:      [{ type: String }],
    openTickets:          { type: Number, default: 0 },
    tags:                 [{ type: String }],
    notes:                { type: String, default: "" },
    crmNotes:             [crmNoteSchema],
  },
  { timestamps: true }
);

customerSchema.index({ email: 1 });
customerSchema.index({ segment: 1 });
customerSchema.index({ risk: 1 });

export const Customer = mongoose.model("Customer", customerSchema);
