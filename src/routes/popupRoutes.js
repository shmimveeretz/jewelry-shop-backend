import express from "express";
import {
  getActivePopups,
  recordPopupEvent,
} from "../controllers/dppController.js";

const router = express.Router();

// Popup rules for storefront pages. DPPs get theirs inside /api/dpp/:slug.
router.get("/active", getActivePopups);

// Analytics beacon from the popup runtime. Public by necessity: it fires for
// anonymous visitors. Only ever $inc's a counter.
router.post("/:id/events", recordPopupEvent);

export default router;
