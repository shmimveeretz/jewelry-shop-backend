import express from "express";
import {
  createPreviewToken,
  createProductPage,
  deleteProductPage,
  duplicateProductPage,
  getProductPage,
  listProductPages,
  publishProductPage,
  restoreRevision,
  unpublishProductPage,
  updateProductPage,
  updateProductPageBlocks,
} from "../controllers/productPageController.js";
import { describeBlockTypes } from "../utils/blockValidation.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// Everything here is admin-only; the client-side gate in the panel is UX only.
router.use(protect, authorize("admin", "roi"));

// Block catalog, so the inspector builds its forms from server metadata
// instead of a duplicated client copy.
router.get("/block-types", (req, res) => {
  res.json({ success: true, data: describeBlockTypes() });
});

router.get("/product-pages", listProductPages);
router.post("/product-pages", createProductPage);
router.get("/product-pages/:id", getProductPage);
router.put("/product-pages/:id", updateProductPage);
router.patch("/product-pages/:id/blocks", updateProductPageBlocks);
router.post("/product-pages/:id/publish", publishProductPage);
router.post("/product-pages/:id/unpublish", unpublishProductPage);
router.post("/product-pages/:id/duplicate", duplicateProductPage);
router.post("/product-pages/:id/preview-token", createPreviewToken);
router.post("/product-pages/:id/revisions/:index/restore", restoreRevision);
router.delete("/product-pages/:id", deleteProductPage);

export default router;
