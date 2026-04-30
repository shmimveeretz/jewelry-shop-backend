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
  verifyPayment,
  generatePaymentLinkHandler,
  createDocumentHandler,
} from "../controllers/paymentController.js";
import { protect, admin, optionalProtect } from "../middleware/auth.js";

const router = express.Router();

// Payment verification - saves order after PayPlus redirects back
router.get("/verify/:transactionUid", verifyPayment);

// PayPlus enhanced payment link (includes initial_invoice: true)
router.post("/generate-link", generatePaymentLinkHandler);

// PayPlus Books — create fiscal document by docType in path param (admin only)
router.post("/documents/:docType", protect, admin, createDocumentHandler);

// PayPlus Books — create fiscal document with docType in request body (admin only)
// Alias used by the admin panel at /api/payplus/create-document
router.post("/create-document", protect, admin, async (req, res) => {
  req.params.docType = req.body.docType || "inv_tax_receipt";
  return createDocumentHandler(req, res);
});

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
