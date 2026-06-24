import mongoose from "mongoose";

const NewsletterSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  couponCode: {
    type: String,
  },
  subscribedAt: {
    type: Date,
    default: Date.now,
  },
  active: {
    type: Boolean,
    default: true,
  },
});

export default mongoose.model("Newsletter", NewsletterSchema);
