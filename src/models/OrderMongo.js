import mongoose from "mongoose";

// Inline selections schema (mirrors CartItemMongo.selectionsSchema)
// Kept inline to avoid import side-effects in legacy code paths.
const orderSelectionsSchema = new mongoose.Schema(
  {
    metalType: { type: String, default: "" },
    length: { type: String, default: "" },
    jewelryType: { type: String, default: "" },
    extraLetters: { type: [String], default: [] },
  },
  { _id: false },
);

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
        // Legacy generic bag — kept for backward compatibility
        selectedOptions: { type: mongoose.Schema.Types.Mixed, default: {} },
        // Explicit typed selections (new fields for bracelet builder)
        selections: { type: orderSelectionsSchema, default: () => ({}) },
      },
    ],

    // Shipping
    shippingAddress: {
      fullName: String,
      address: String,
      city: String,
      zipCode: String,
    },
    trackingNumber: { type: String, default: "" },

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
    // Prevents duplicate thank-you / admin emails across webhook vs verifyTransaction race
    orderEmailsSent: { type: Boolean, default: false },

    // Order status
    status: {
      type: String,
      enum: [
        "Pending",
        "Paid",
        "Processing",
        "Shipped",
        "Delivered",
        "Cancelled",
      ],
      default: "Pending",
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "orders" },
);

export default mongoose.model("Order", OrderSchema);
