import express from "express";
import {
  getDppBootstrap,
  getDppPreview,
} from "../controllers/dppController.js";

const router = express.Router();

// Preview is matched first so a page slugged "preview" can't shadow it.
router.get("/:slug/preview", getDppPreview);
router.get("/:slug", getDppBootstrap);

export default router;
