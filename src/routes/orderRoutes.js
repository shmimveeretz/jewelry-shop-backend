import express from "express";
import {
  getAllOrders,
  createOrder,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
} from "../controllers/orderController.js";
import { protect, admin } from "../middleware/auth.js";

const router = express.Router();

// Order management endpoints
router.get("/", protect, admin, getAllOrders); // Admin only - view all orders
router.post("/", protect, createOrder); // Any authenticated user can create order
router.get("/:id", protect, getOrderById); // Get specific order
router.put("/:id/status", protect, admin, updateOrderStatus); // Admin only - update status
router.delete("/:id", protect, admin, deleteOrder); // Admin only - delete order

export default router;
