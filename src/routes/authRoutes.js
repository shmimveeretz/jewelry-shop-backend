import express from "express";
import rateLimit from "express-rate-limit";
import {
  register,
  login,
  getMe,
  updateProfile,
  updatePassword,
  forgotPassword,
  verifyCode,
  changePassword,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Brute-force guard for credential and reset-code endpoints. Counted per IP
// on top of the general /api limiter.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "יותר מדי ניסיונות. נסה שוב בעוד מספר דקות",
  },
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/forgotpassword", authLimiter, forgotPassword);
router.post("/verifycode", authLimiter, verifyCode);
router.post("/changepassword", authLimiter, changePassword);
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);
router.put("/password", protect, authLimiter, updatePassword);

// User management lives in userRoutes.js (/api/users), behind the admin gate.

export default router;
