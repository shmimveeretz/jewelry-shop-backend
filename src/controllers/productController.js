import Product from "../models/Product.js";
import { uploadImage, deleteImage } from "../utils/cloudinaryUpload.js";

// @desc    Get all products
// @route   GET /api/products
// @access  Public
export const getProducts = async (req, res) => {
  try {
    const { category, zodiacSign, minPrice, maxPrice, search, sort } =
      req.query;

    const filters = {};
    if (category) filters.category = category;
    if (zodiacSign) filters.zodiacSign = zodiacSign;
    if (minPrice) filters.minPrice = Number(minPrice);
    if (maxPrice) filters.maxPrice = Number(maxPrice);
    if (search) filters.search = search;
    if (sort) filters.sort = sort;

    const products = await Product.findAll(filters);

    res.json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
export const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "מוצר לא נמצא",
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Create product (Admin)
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = async (req, res) => {
  try {
    const { name, price, description, category, zodiacSign, stock } = req.body;
    let imageUrl = null;

    // Validate required fields
    if (!name || !price || !description) {
      return res.status(400).json({
        success: false,
        message: "שם, מחיר ותיאור נדרשים",
      });
    }

    // Upload image to Cloudinary if provided
    if (req.file) {
      try {
        const upload = await uploadImage(req.file.buffer, "products");
        imageUrl = upload.url;
        console.log("📸 Image uploaded:", imageUrl);
      } catch (uploadError) {
        console.error("❌ Image upload failed:", uploadError);
        return res.status(400).json({
          success: false,
          message: "Failed to upload image: " + uploadError.message,
        });
      }
    }

    // Create product
    const product = await Product.create({
      name,
      price,
      description,
      category,
      zodiacSign,
      stock,
      image: imageUrl, // Store Cloudinary URL
    });

    res.status(201).json({
      success: true,
      message: "מוצר נוצר בהצלחה",
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update product (Admin)
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = async (req, res) => {
  try {
    const { name, price, description, category, zodiacSign, stock } = req.body;
    const productId = req.params.id;

    // Get existing product
    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "מוצר לא נמצא",
      });
    }

    let imageUrl = existingProduct.image; // Keep existing image

    // Upload new image if provided
    if (req.file) {
      try {
        // Delete old image from Cloudinary
        if (existingProduct.image) {
          const publicId = extractPublicId(existingProduct.image);
          if (publicId) await deleteImage(publicId);
        }

        // Upload new image
        const upload = await uploadImage(req.file.buffer, "products");
        imageUrl = upload.url;
        console.log("📸 Image updated:", imageUrl);
      } catch (uploadError) {
        console.error("❌ Image upload failed:", uploadError);
        return res.status(400).json({
          success: false,
          message: "Failed to upload image",
        });
      }
    }

    // Update product
    const product = await Product.update(productId, {
      name,
      price,
      description,
      category,
      zodiacSign,
      stock,
      image: imageUrl,
    });

    res.json({
      success: true,
      message: "מוצר עודכן בהצלחה",
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Helper function to extract public ID from Cloudinary URL
const extractPublicId = (url) => {
  try {
    const parts = url.split("/");
    const fileName = parts[parts.length - 1];
    return `shamayim-vaaretz/products/${fileName.split(".")[0]}`;
  } catch {
    return null;
  }
};

// @desc    Delete product (Admin)
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = async (req, res) => {
  try {
    const success = await Product.delete(req.params.id);

    if (!success) {
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
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Add review
// @route   POST /api/products/:id/reviews
// @access  Private
export const addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "מוצר לא נמצא",
      });
    }

    // Check if user already reviewed
    const alreadyReviewed = product.reviews?.find(
      (review) => review.user === req.user.id,
    );

    if (alreadyReviewed) {
      return res.status(400).json({
        success: false,
        message: "כבר הוספת ביקורת למוצר זה",
      });
    }

    const review = {
      user: req.user.id,
      name: req.user.name,
      rating: Number(rating),
      comment,
    };

    await Product.addReview(req.params.id, review);

    res.status(201).json({
      success: true,
      message: "הביקורת נוספה בהצלחה",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
