import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ["customer", "seller", "support", "admin", "driver", "sales_rep"], default: "customer" },
    shopId: { type: String, default: null },
    driverId: { type: String, default: null },
    shopCategory: { type: String, enum: ["perfume", "cake", "dessert", "gift_box", "mixed"], default: null },
    shopCategories: [{ type: String, enum: ["perfume", "cake", "dessert", "gift_box", "mixed"] }],
    permissions: [{ type: String }],
    refreshToken: { type: String, select: false, default: null },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
    phone: { type: String, trim: true, default: null },
    addresses: [{
      _id: false,
      id: { type: String, required: true },
      label: { type: String, trim: true, default: "Home" },
      line1: { type: String, trim: true, required: true },
      line2: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
      isDefault: { type: Boolean, default: false },
    }],
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  return obj;
};

export const User = mongoose.model("User", userSchema);
