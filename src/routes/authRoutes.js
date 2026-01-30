import express from "express";
import {
  register,
  login,
  getMe,
  updateProfile,
  updatePassword,
  forgotPassword,
  verifyCode,
  changePassword,
  resetPassword,
  getAllUsers,
  updateUserRole,
  deleteUser,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgotpassword", forgotPassword);
router.post("/verifycode", verifyCode);
router.post("/changepassword", changePassword);
router.put("/resetpassword/:code", resetPassword);
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);
router.put("/password", protect, updatePassword);

// User management endpoints (admin)
router.get("/", protect, getAllUsers);
router.put("/:id/role", protect, updateUserRole);
router.delete("/:id", protect, deleteUser);

export default router;
