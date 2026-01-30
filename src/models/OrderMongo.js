import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
      required: [true, "מספר הזמנה נדרש"],
      description: "מספר הזמנה ייחודי (ORD-001, ORD-002, וכו')",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "ID של המשתמש נדרש"],
      description: "ID של המשתמש שהזמין",
    },
    customerName: {
      type: String,
      required: [true, "שם הלקוח נדרש"],
    },
    email: {
      type: String,
      required: [true, "אימייל נדרש"],
    },
    items: [
      {
        productId: String,
        name: String,
        price: Number,
        quantity: Number,
      },
    ],
    totalPrice: {
      type: Number,
      required: [true, "סכום כולל נדרש"],
      description: "סכום כולל של ההזמנה",
    },
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
      description: "סטטוס ההזמנה",
    },
    shippingAddress: {
      street: String,
      city: String,
      zipCode: String,
      country: String,
    },
    paymentMethod: String,
    notes: String,
  },
  {
    timestamps: true,
  },
);

const Order = mongoose.model("Order", orderSchema);

export default Order;
