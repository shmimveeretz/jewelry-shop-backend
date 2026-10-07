import express from "express";
import rateLimit from "express-rate-limit";
import {
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderTracking,
  deleteOrder,
  verifyTransaction,
  getCouponStats,
  trackOrderByOrderId,
} from "../controllers/orderController.js";
import { protect, admin, optionalProtect } from "../middleware/auth.js";

const router = express.Router();

// Stricter limit on public order tracking to deter order-number guessing
const trackOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "יותר מדי ניסיונות מעקב. נסה שוב מאוחר יותר",
  },
});

// Confirms the payment with PayPlus server-side, then saves the order
router.post("/verify-transaction", optionalProtect, verifyTransaction);

// Public order tracking (must be before /:id)
router.get("/track/:orderId", trackOrderLimiter, trackOrderByOrderId);

// Order management endpoints
router.get("/", protect, admin, getAllOrders);
router.get("/coupon-stats", protect, admin, getCouponStats);
router.get("/:id", protect, getOrderById); // owner or admin (checked in controller)
router.put("/:id/status", protect, admin, updateOrderStatus);
router.put("/:id/tracking", protect, admin, updateOrderTracking);
router.delete("/:id", protect, admin, deleteOrder);

export default router;
