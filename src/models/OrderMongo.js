import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    customer"name": String,
    email: String,
    items: [
      {
        productId: mongoose.Schema.Types.ObjectId,
        "name": String,
        quantity: Number,
        price: Number,
      },
    ],
    totalPrice: Number,
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    shippingAddress: String,
    paymentMethod: String,
    notes: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: "orders" },
);

export default mongoose.model("Order", OrderSchema);
