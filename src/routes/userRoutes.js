import express from "express";
import {
  getAllUsers,
  updateUserRole,
  deleteUser,
  blockUser,
} from "../controllers/authController.js";
import { protect, admin } from "../middleware/auth.js";

const router = express.Router();

// User management endpoints (admin only)
router.get("/", protect, admin, getAllUsers);
router.put("/:id/role", protect, admin, updateUserRole);
router.put("/:id/block", protect, admin, blockUser);
router.delete("/:id", protect, admin, deleteUser);

export default router;
