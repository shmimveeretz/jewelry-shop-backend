import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
  {
    // Legacy fields (kept for backward compat)
    orderId: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    email: String,
    paymentMethod: String,
    notes: String,

    // Customer info
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    customerPhone: { type: String },

    // Items
    items: [
      {
        productId: String,
        name: String,
        price: Number,
        quantity: Number,
        selectedOptions: { type: mongoose.Schema.Types.Mixed, default: {} },
      },
    ],

    // Shipping
    shippingAddress: {
      fullName: String,
      address: String,
      city: String,
      zipCode: String,
    },

    // Pricing
    itemsPrice: { type: Number, default: 0 },
    shippingPrice: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },
    couponCode: { type: String, default: null },
    discountPercent: { type: Number, default: 0 },

    // Payment
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    transactionUid: { type: String },

    // Order status
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "orders" },
);

export default mongoose.model("Order", OrderSchema);
