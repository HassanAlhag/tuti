import mongoose from "mongoose";

const salesRepSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    plan: { type: String, enum: ["Starter", "Standard", "Premium", "Enterprise"], default: "Standard" },
    status: { type: String, enum: ["Active", "Pending", "Inactive"], default: "Active" },
  },
  { timestamps: true }
);

export const SalesRep = mongoose.model("SalesRep", salesRepSchema);
