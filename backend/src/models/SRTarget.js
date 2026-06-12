import mongoose from "mongoose";

const srTargetSchema = new mongoose.Schema(
  {
    srCode:         { type: String, required: true, uppercase: true, trim: true },
    period:         { type: String, required: true }, // YYYY-MM
    gmvTarget:      { type: Number, default: 0 },
    referralTarget: { type: Number, default: 0 },
  },
  { timestamps: true }
);
srTargetSchema.index({ srCode: 1, period: 1 }, { unique: true });

export const SRTarget = mongoose.model("SRTarget", srTargetSchema);
