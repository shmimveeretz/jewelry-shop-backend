import Product from "../models/Product.js";
import { uploadImage, deleteImage } from "../utils/cloudinaryUpload.js";

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

    console.log("📋 Get Products Request:");
    console.log("Filters:", { category, minPrice, maxPrice, limit, page });

    // Build filter
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
        { "name": { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Fetch products with pagination
    const products = await Product.findAll(filter);
    const paginatedProducts = products.slice(skip, skip + parseInt(limit));
    const total = products.length;

    console.log(`✅ Found ${total} products, returning page ${page}`);

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

    console.log("🔍 Get Product by ID:", id);

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
      description,
      price,
      category,
      zodiacSign,
      metals,
      stock,
      discountPrice,
    } = req.body;

    console.log("📦 Create Product Request:");
    console.log("name":, name);
    console.log("Price:", price);

    // Validate required fields
    if (!name || !price || !description || !category) {
      return res.status(400).json({
        success: false,
        message: "שם, מחיר, תיאור וקטגוריה נדרשים",
      });
    }

    let imageUrl = null;

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
    const productData = {
      name,
      description,
      price: parseFloat(price),
      category,
      zodiacSign: zodiacSign || "כללי",
      stock: stock ? parseInt(stock) : 0,
      isAvailable: stock ? parseInt(stock) > 0 : false,
    };

    if (imageUrl) {
      productData.images = [{ url: imageUrl, alt: name }];
    }

    if (metals) {
      productData.metals = Array.isArray(metals) ? metals : [metals];
    }

    if (discountPrice) {
      productData.discountPrice = parseFloat(discountPrice);
    }

    const product = await Product.create(productData);

    console.log("✅ Product created:", product._id);

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
    const {
      name,
      description,
      price,
      category,
      zodiacSign,
      metals,
      stock,
      discountPrice,
    } = req.body;

    console.log("📝 Update Product Request:");
    console.log("Product ID:", id);

    // Get existing product
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "מוצר לא נמצא",
      });
    }

    // Handle image upload
    let images = existingProduct.images;
    if (req.file) {
      try {
        // Delete old image from Cloudinary if exists
        if (existingProduct.images && existingProduct.images.length > 0) {
          const publicId = extractPublicId(existingProduct.images[0].url);
          if (publicId) await deleteImage(publicId);
        }

        // Upload new image
        const upload = await uploadImage(req.file.buffer, "products");
        images = [{ url: upload.url, alt: name || existingProduct.name }];
        console.log("📸 Image updated:", images[0].url);
      } catch (uploadError) {
        console.error("❌ Image upload failed:", uploadError);
        return res.status(400).json({
          success: false,
          message: "Failed to upload image",
        });
      }
    }

    // Prepare update data
    const updateData = {};
    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (price) updateData.price = parseFloat(price);
    if (category) updateData.category = category;
    if (zodiacSign) updateData.zodiacSign = zodiacSign;
    if (stock !== undefined) {
      updateData.stock = parseInt(stock);
      updateData.isAvailable = parseInt(stock) > 0;
    }
    if (discountPrice) updateData.discountPrice = parseFloat(discountPrice);
    if (metals) updateData.metals = Array.isArray(metals) ? metals : [metals];
    if (images) updateData.images = images;

    const product = await Product.update(id, updateData);

    console.log("✅ Product updated:", id);

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

    console.log("🗑️ Delete Product:", id);

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "מוצר לא נמצא",
      });
    }

    // Delete image from Cloudinary
    if (product.images && product.images.length > 0) {
      try {
        const publicId = extractPublicId(product.images[0].url);
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

    console.log("✅ Product deleted successfully");

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

    console.log("⭐ Add Review Request:");
    console.log("Product ID:", id);
    console.log("Rating:", rating);

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

    const review = {
      name,
      rating: parseInt(rating),
      comment,
      date: new Date().toISOString(),
    };

    await product.addReview(review);

    console.log("✅ Review added successfully");

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

// Helper function to extract public ID from Cloudinary URL
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
