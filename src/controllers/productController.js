import Product from "../models/Product.js";
import { uploadImage, deleteImage } from "../utils/cloudinaryUpload.js";

const parseArrayField = (value) => {
  if (!value) return undefined;
  if (Array.isArray(value)) return value;
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
};

const getImageUrl = (img) => {
  if (!img) return null;
  return typeof img === "string" ? img : img.url || null;
};

// @desc    Get all products with filters and pagination
// @route   GET /api/products
// @access  Public
export const getProducts = async (req, res) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      limit = 100,
      page = 1,
      search,
    } = req.query;
    const skip = (page - 1) * limit;

    let filter = {};

    if (category && category !== "הכל") {
      filter.category = category;
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const products = await Product.findAll(filter);
    const paginatedProducts = products.slice(skip, skip + parseInt(limit));
    const total = products.length;

    res.json({
      success: true,
      message: "Products retrieved successfully",
      data: paginatedProducts,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error("❌ Error getting products:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public
export const getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "מוצר לא נמצא",
      });
    }

    res.json({
      success: true,
      message: "Product retrieved successfully",
      data: product,
    });
  } catch (error) {
    console.error("❌ Error getting product:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      nameEn,
      description,
      descriptionEn,
      price,
      category,
      categoryEn,
      letter,
      meaningHe,
      gematria,
      types,
      metals,
      stock,
      discountPrice,
      status,
    } = req.body;

    if (!name || !price || !description || !category) {
      return res.status(400).json({
        success: false,
        message: "שם, מחיר, תיאור וקטגוריה נדרשים",
      });
    }

    let imageUrl = null;
    if (req.file) {
      try {
        const upload = await uploadImage(req.file.buffer, "products");
        imageUrl = upload.url;
      } catch (uploadError) {
        return res.status(400).json({
          success: false,
          message: "Failed to upload image: " + uploadError.message,
        });
      }
    }

    const productData = {
      name,
      nameEn: nameEn || "",
      description,
      descriptionEn: descriptionEn || "",
      price: parseFloat(price),
      category,
      categoryEn: categoryEn || "",
      letter: letter || "",
      meaningHe: meaningHe || "",
      gematria: gematria ? parseInt(gematria) : undefined,
      types: parseArrayField(types),
      metals: parseArrayField(metals),
      stock: stock ? parseInt(stock) : 0,
      discountPrice: discountPrice ? parseFloat(discountPrice) : undefined,
      status: status === "inactive" ? "inactive" : "active",
    };

    if (imageUrl) {
      productData.images = [imageUrl];
    }

    const product = await Product.create(productData);

    res.status(201).json({
      success: true,
      message: "מוצר נוצר בהצלחה",
      data: product,
    });
  } catch (error) {
    console.error("❌ Error creating product:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const existingProduct = await Product.findById(id);

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "מוצר לא נמצא",
      });
    }

    let images = existingProduct.images;
    if (req.file) {
      try {
        const oldUrl = getImageUrl(existingProduct.images?.[0]);
        if (oldUrl) {
          const publicId = extractPublicId(oldUrl);
          if (publicId) await deleteImage(publicId);
        }

        const upload = await uploadImage(req.file.buffer, "products");
        images = [upload.url];
      } catch (uploadError) {
        return res.status(400).json({
          success: false,
          message: "Failed to upload image",
        });
      }
    }

    const updateData = {};
    const fields = [
      "name",
      "nameEn",
      "description",
      "descriptionEn",
      "category",
      "categoryEn",
      "letter",
      "meaningHe",
      "status",
    ];

    for (const field of fields) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }

    if (req.body.price !== undefined) updateData.price = parseFloat(req.body.price);
    if (req.body.stock !== undefined) updateData.stock = parseInt(req.body.stock);
    if (req.body.gematria !== undefined)
      updateData.gematria = parseInt(req.body.gematria);
    if (req.body.discountPrice !== undefined)
      updateData.discountPrice = parseFloat(req.body.discountPrice);
    if (req.body.types !== undefined) updateData.types = parseArrayField(req.body.types);
    if (req.body.metals !== undefined) updateData.metals = parseArrayField(req.body.metals);
    if (images) updateData.images = images;

    const product = await Product.update(id, updateData);

    res.json({
      success: true,
      message: "מוצר עודכן בהצלחה",
      data: product,
    });
  } catch (error) {
    console.error("❌ Error updating product:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "מוצר לא נמצא",
      });
    }

    const imageUrl = getImageUrl(product.images?.[0]);
    if (imageUrl) {
      try {
        const publicId = extractPublicId(imageUrl);
        if (publicId) await deleteImage(publicId);
      } catch (error) {
        console.warn("⚠️ Could not delete image from Cloudinary:", error);
      }
    }

    const result = await Product.delete(id);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "מוצר לא נמצא",
      });
    }

    res.json({
      success: true,
      message: "מוצר נמחק בהצלחה",
    });
  } catch (error) {
    console.error("❌ Error deleting product:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Add review to product
// @route   POST /api/products/:id/reviews
// @access  Private
export const addReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, rating, comment } = req.body;

    if (!name || !rating || !comment) {
      return res.status(400).json({
        success: false,
        message: "שם, דירוג והערה נדרשים",
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "הדירוג חייב להיות בין 1 ל-5",
      });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "מוצר לא נמצא",
      });
    }

    await Product.addReview(id, {
      rating: parseInt(rating),
      comment,
    });

    res.json({
      success: true,
      message: "הערה נוספה בהצלחה",
      data: product,
    });
  } catch (error) {
    console.error("❌ Error adding review:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const extractPublicId = (url) => {
  try {
    const parts = url.split("/");
    const fileName = parts[parts.length - 1];
    const fileNameWithoutExt = fileName.split(".")[0];
    return `shamayim-vaaretz/products/${fileNameWithoutExt}`;
  } catch {
    return null;
  }
};
