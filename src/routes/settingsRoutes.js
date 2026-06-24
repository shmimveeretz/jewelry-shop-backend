import express from "express";
import { getMotd, updateMotd } from "../controllers/settingsController.js";
import { protect, admin } from "../middleware/auth.js";

const router = express.Router();

router.get("/motd", getMotd);
router.put("/motd", protect, admin, updateMotd);

export default router;
