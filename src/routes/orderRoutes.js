import express from "express";
import {
  getAllOrders,
  createOrder,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
  orderSuccess,
  verifyTransaction,
  createFromPayment,
  getCouponStats,
  addToCart,
} from "../controllers/orderController.js";
import { generatePaymentLinkHandler } from "../controllers/paymentController.js";
import { protect, admin, optionalProtect } from "../middleware/auth.js";

const router = express.Router();

// Validate a cart item and calculate server-side price — never trusts frontend price
router.post("/cart/add", optionalProtect, addToCart);

// Generate a PayPlus payment link — called by frontend before redirecting to payment page
router.post("/create-payment", optionalProtect, generatePaymentLinkHandler);

// Verify PayPlus payment server-side and save order — SECURITY: keeps API keys off the frontend
router.post("/verify-transaction", optionalProtect, verifyTransaction);

// Save full order from frontend localStorage after PayPlus redirects back
router.post("/create-from-payment", optionalProtect, createFromPayment);

// Order success callback — called by frontend after payment gateway confirms payment
router.post("/success", optionalProtect, orderSuccess);

// Order management endpoints
router.get("/", protect, admin, getAllOrders); // Admin only - view all orders
router.get("/coupon-stats", protect, admin, getCouponStats); // Admin only - coupon usage stats
router.post("/", protect, createOrder); // Any authenticated user can create order
router.get("/:id", protect, getOrderById); // Get specific order
router.put("/:id/status", protect, admin, updateOrderStatus); // Admin only - update status
router.delete("/:id", protect, admin, deleteOrder); // Admin only - delete order

export default router;
