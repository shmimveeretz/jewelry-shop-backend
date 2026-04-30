import express from "express";
import {
  subscribe,
  getSubscribers,
  toggleSubscription,
  sendBulkEmail,
} from "../controllers/newsletterController.js";
import { protect, admin } from "../middleware/auth.js";

const router = express.Router();

router.post("/subscribe", subscribe);
router.get("/subscribers", protect, admin, getSubscribers);
router.put("/toggle/:userId", protect, admin, toggleSubscription);
router.post("/send", protect, admin, sendBulkEmail);

export default router;
