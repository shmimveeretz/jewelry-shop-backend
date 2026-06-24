import express from "express";
import {
  subscribe,
  getSubscribers,
  toggleSubscription,
  toggleSubscriber,
  deleteSubscriber,
  sendBulkEmail,
} from "../controllers/newsletterController.js";
import { protect, admin } from "../middleware/auth.js";

const router = express.Router();

router.post("/subscribe", subscribe);
router.get("/subscribers", protect, admin, getSubscribers);
router.put("/toggle/:userId", protect, admin, toggleSubscription);
router.patch("/subscribers/:id/toggle", protect, admin, toggleSubscriber);
router.delete("/subscribers/:id", protect, admin, deleteSubscriber);
router.post("/send", protect, admin, sendBulkEmail);

export default router;
