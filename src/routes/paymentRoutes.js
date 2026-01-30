import express from "express";
import {
  createPaymentIntent,
  createOrder,
  getOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
  payPlusWebhook,
  testOrderDemo,
  debugOrder,
} from "../controllers/paymentController.js";
import { protect, admin, optionalProtect } from "../middleware/auth.js";

const router = express.Router();

// Demo/Test routes (public for easy testing)
router.post("/test-order", testOrderDemo);
router.post("/debug-order", debugOrder); // Removed optionalProtect

// Webhook route (must be before body parser)
router.post("/webhook", express.json(), payPlusWebhook);

// Payment & Order routes - NO AUTHENTICATION REQUIRED (supports guests)
router.post("/create-intent", createPaymentIntent); // No auth - guests can pay
router.post("/create-order", createOrder); // Main endpoint - no auth
router.post("/create-order-guest", createOrder); // Alternative name - no auth

// Protected routes (user must be logged in)
router.get("/my-orders", protect, getMyOrders);
router.get("/orders", protect, admin, getAllOrders);
router.get("/orders/:id", protect, getOrder);
router.put("/orders/:id/status", protect, admin, updateOrderStatus);

export default router;
