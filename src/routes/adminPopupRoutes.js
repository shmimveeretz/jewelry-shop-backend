import express from "express";
import {
  createPopup,
  deletePopup,
  duplicatePopup,
  getPopup,
  getPopupStats,
  listPopups,
  resetPopupStats,
  updatePopup,
  updatePopupStatus,
} from "../controllers/marketingPopupController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(protect, authorize("admin", "roi"));

router.get("/popups", listPopups);
router.post("/popups", createPopup);
router.get("/popups/:id", getPopup);
router.put("/popups/:id", updatePopup);
router.patch("/popups/:id/status", updatePopupStatus);
router.post("/popups/:id/duplicate", duplicatePopup);
router.get("/popups/:id/stats", getPopupStats);
router.delete("/popups/:id", deletePopup);

// Wiping A/B results is irreversible, so it stays with the superadmin role.
router.post("/popups/:id/stats/reset", authorize("roi"), resetPopupStats);

export default router;
