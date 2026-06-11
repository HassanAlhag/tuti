import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    productId: { type: String, required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    customer: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, default: "" },
    body: { type: String, default: "" },
    verified: { type: Boolean, default: false },
    helpful: { type: Number, default: 0 },
    date: { type: String, default: "" },
    aspects: {
      scent: { type: Number, min: 1, max: 5, default: 4 },
      longevity: { type: Number, min: 1, max: 5, default: 4 },
      value: { type: Number, min: 1, max: 5, default: 4 },
    },
  },
  { timestamps: true }
);

reviewSchema.index({ productId: 1 });

export const Review = mongoose.model("Review", reviewSchema);
