import mongoose from "mongoose";

const CouponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  discountPercent: {
    type: Number,
    required: true,
    min: 1,
    max: 100,
  },
  type: {
    type: String,
    enum: ["newsletter", "manual"],
    default: "manual",
  },
  description: {
    type: String,
    default: "",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  // null = unlimited. Newsletter welcome codes are single-use.
  maxUses: {
    type: Number,
    default: null,
    min: 1,
  },
  // Counted when a paid order using the code is saved
  usedCount: {
    type: Number,
    default: 0,
  },
  // null = never expires
  expiresAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

/** Why a coupon cannot be used right now, or null when it can. */
CouponSchema.methods.unavailableReason = function () {
  if (!this.isActive) return "inactive";
  if (this.expiresAt && this.expiresAt.getTime() < Date.now()) return "expired";
  if (this.maxUses != null && (this.usedCount || 0) >= this.maxUses) return "used-up";
  return null;
};

export default mongoose.model("Coupon", CouponSchema);
