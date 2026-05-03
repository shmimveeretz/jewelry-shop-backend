import mongoose from "mongoose";

/**
 * Temporary storage for order data while the customer is on the PayPlus payment page.
 * Keyed by pageRequestUid so the webhook can retrieve it when PayPlus calls back.
 * Documents expire automatically after 24 hours via MongoDB TTL index.
 */
const pendingOrderSchema = new mongoose.Schema({
  pageRequestUid: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  orderData: {
    type: Object,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400, // TTL: 24 hours
  },
});

export default mongoose.model("PendingOrder", pendingOrderSchema);
