import express from "express";
import {
  getAllOrders,
  createOrder,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
  orderSuccess,
} from "../controllers/orderController.js";
import { protect, admin, optionalProtect } from "../middleware/auth.js";

const router = express.Router();

// Order success callback — called by frontend after payment gateway confirms payment
// optionalProtect: links order to user when logged in, works for guests too
router.post("/success", optionalProtect, orderSuccess);

// Order management endpoints
router.get("/", protect, admin, getAllOrders); // Admin only - view all orders
router.post("/", protect, createOrder); // Any authenticated user can create order
router.get("/:id", protect, getOrderById); // Get specific order
router.put("/:id/status", protect, admin, updateOrderStatus); // Admin only - update status
router.delete("/:id", protect, admin, deleteOrder); // Admin only - delete order

export default router;
