import express from "express";
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  addReview,
} from "../controllers/productController.js";
import { importProducts } from "../controllers/importController.js";
import { protect, admin } from "../middleware/auth.js";
import { uploadSingle } from "../middleware/upload.js";

const router = express.Router();

// Import products from jewelry.json
router.post("/import", protect, admin, importProducts);

router
  .route("/")
  .get(getProducts)
  .post(protect, admin, uploadSingle, createProduct);

router
  .route("/:id")
  .get(getProduct)
  .put(protect, admin, uploadSingle, updateProduct)
  .delete(protect, admin, deleteProduct);

router.post("/:id/reviews", protect, addReview);

export default router;
