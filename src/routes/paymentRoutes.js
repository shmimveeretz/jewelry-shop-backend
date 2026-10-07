import express from "express";
import {
  createPaymentIntent,
  getOrder,
  getMyOrders,
  payPlusWebhook,
  createDocumentHandler,
} from "../controllers/paymentController.js";
import { protect, admin, optionalProtect } from "../middleware/auth.js";

const router = express.Router();

// PayPlus Books — create fiscal document by docType in path param (admin only)
router.post("/documents/:docType", protect, admin, createDocumentHandler);

// PayPlus Books — create fiscal document with docType in request body (admin only)
router.post("/create-document", protect, admin, async (req, res) => {
  req.params.docType = req.body.docType || "inv_tax_receipt";
  return createDocumentHandler(req, res);
});

// PayPlus server-to-server callback (HMAC verified inside the handler)
router.post("/webhook", payPlusWebhook);

// Checkout — guests allowed; a logged-in user is linked to the order
router.post("/create-intent", optionalProtect, createPaymentIntent);

// Protected routes (user must be logged in)
router.get("/my-orders", protect, getMyOrders);
router.get("/orders/:id", protect, getOrder);

export default router;
