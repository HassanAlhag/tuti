import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
  {
    srCode:       { type: String, required: true, index: true, uppercase: true, trim: true },
    businessName: { type: String, required: true, trim: true, maxlength: 200 },
    contactName:  { type: String, trim: true, default: "", maxlength: 200 },
    phone:        { type: String, trim: true, default: "", maxlength: 50 },
    city:         { type: String, trim: true, default: "", maxlength: 100 },
    status: {
      type: String,
      enum: ["new", "contacted", "interested", "followup", "converted", "lost"],
      default: "new",
      index: true,
    },
    followUpAt: { type: Date, default: null },
    notes: [
      {
        body:      { type: String, maxlength: 1000 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export const Lead = mongoose.model("Lead", leadSchema);
