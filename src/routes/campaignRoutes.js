import express from "express";
import { getCampaignProduct } from "../controllers/campaignController.js";

const router = express.Router();

router.get("/products/:id", getCampaignProduct);

export default router;
