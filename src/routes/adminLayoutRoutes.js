import express from "express";
import {
  getLayoutPreference,
  resetLayoutPreference,
  saveDashboardWidgets,
  saveLayoutPreference,
  saveSidebarPreference,
} from "../controllers/adminLayoutController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(protect, authorize("admin", "roi"));

// Always scoped to req.user._id inside the controller — there is no route
// here that can read or write another admin's workspace.
router.get("/layout-preference", getLayoutPreference);
router.put("/layout-preference", saveLayoutPreference);
router.patch("/layout-preference/widgets", saveDashboardWidgets);
router.patch("/layout-preference/sidebar", saveSidebarPreference);
router.delete("/layout-preference", resetLayoutPreference);

export default router;
