import express from "express";
import {
  validateCoupon,
  getCoupons,
  createCoupon,
  deleteCoupon,
} from "../controllers/couponController.js";
import { protect, admin } from "../middleware/auth.js";

const router = express.Router();

router.post("/validate", validateCoupon);
router.get("/", protect, admin, getCoupons);
router.post("/", protect, admin, createCoupon);
router.delete("/:id", protect, admin, deleteCoupon);

export default router;
