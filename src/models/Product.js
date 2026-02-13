import ProductMongo from "./ProductMongo.js";

class ProductModel {
  constructor() {
    this.Model = ProductMongo;
    this.validCategories = ["מגן דוד", "חי", "חמסה", "מזוזה", "אותיות", "אחר"];
    this.validMetals = ["זהב", "כסף", "זהב לבן", "זהב צהוב"];
    this.validChains = ["חוט שעווה", "שרשרת זהב", "שרשרת כסף"];
    this.validZodiacSigns = [
      "טלה",
      "שור",
      "תאומים",
      "סרטן",
      "אריה",
      "בתולה",
      "מאזניים",
      "עקרב",
      "קשת",
      "גדי",
      "דלי",
      "דגים",
      "כללי",
    ];
  }

  validateProduct(productData) {
    if (!productData.name || productData.name.trim().length === 0) {
      throw new Error("נא להזין שם מוצר");
    }
    if (!productData.description) {
      throw new Error("נא להזין תיאור");
    }
    if (
      !productData.category ||
      !this.validCategories.includes(productData.category)
    ) {
      throw new Error("נא לבחור קטגוריה תקינה");
    }
    if (!productData.price || productData.price < 0) {
      throw new Error("נא להזין מחיר חיובי");
    }
    return true;
  }

  calculateAverageRating(reviews) {
    if (!reviews || reviews.length === 0) {
      return { average: 0, count: 0 };
    }
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    return {
      average: sum / reviews.length,
      count: reviews.length,
    };
  }

  _formatProduct(product) {
    if (!product) return null;
    return {
      id: product._id?.toString() || product.id,
      name: product.name,
      nameEn: product.nameEn,
      description: product.description,
      descriptionEn: product.descriptionEn,
      category: product.category,
      price: product.price,
      discountPrice: product.discountPrice,
      images: product.images || [], // Firebase URLs
      metals: product.metals,
      letter: product.letter,
      meaningHe: product.meaningHe,
      meaningEn: product.meaningEn,
      gematria: product.gematria,
      types: product.types,
      stock: product.stock,
      zodiacSign: product.zodiacSign,
      featured: product.featured,
      rating: product.rating,
      reviews: product.reviews,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  async create(productData) {
    try {
      this.validateProduct(productData);

      const newProduct = await this.Model.create({
        name: productData.name.trim(),
        description: productData.description,
        category: productData.category,
        price: productData.price,
        discountPrice: productData.discountPrice || null,
        images: productData.images || [],
        metals: productData.metals || [],
        lengths: productData.lengths || [],
        chains: productData.chains || [],
        waxColors: productData.waxColors || [],
        stock: productData.stock || 0,
        zodiacSign: productData.zodiacSign || "כללי",
        featured: productData.featured || false,
        rating: { average: 0, count: 0 },
        reviews: [],
      });

      return this._formatProduct(newProduct);
    } catch (error) {
      throw error;
    }
  }

  async findById(id) {
    try {
      const product = await this.Model.findById(id);
      return this._formatProduct(product);
    } catch (error) {
      throw error;
    }
  }

  async findAll(filters = {}) {
    try {
      let query = {};

      // Build MongoDB query
      if (filters.category) {
        query.category = filters.category;
      }
      if (filters.zodiacSign) {
        query.zodiacSign = filters.zodiacSign;
      }
      if (filters.featured !== undefined) {
        query.featured = filters.featured;
      }
      if (filters.minPrice || filters.maxPrice) {
        query.price = {};
        if (filters.minPrice) query.price.$gte = filters.minPrice;
        if (filters.maxPrice) query.price.$lte = filters.maxPrice;
      }
      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: "i" } },
          { description: { $regex: filters.search, $options: "i" } },
        ];
      }

      let products = await this.Model.find(query);

      // Sort
      if (filters.sort === "price-asc") {
        products.sort((a, b) => a.price - b.price);
      } else if (filters.sort === "price-desc") {
        products.sort((a, b) => b.price - a.price);
      } else if (filters.sort === "rating") {
        products.sort(
          (a, b) => (b.rating?.average || 0) - (a.rating?.average || 0),
        );
      }

      return products.map((p) => this._formatProduct(p));
    } catch (error) {
      throw error;
    }
  }

  async update(id, updateData) {
    try {
      const product = await this.Model.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });
      if (!product) {
        throw new Error("מוצר לא נמצא");
      }
      return this._formatProduct(product);
    } catch (error) {
      throw error;
    }
  }

  async delete(id) {
    try {
      const result = await this.Model.findByIdAndDelete(id);
      return result ? true : false;
    } catch (error) {
      throw error;
    }
  }

  async addReview(productId, review) {
    try {
      const product = await this.Model.findById(productId);
      if (!product) {
        throw new Error("מוצר לא נמצא");
      }

      const newReview = {
        ...review,
        date: new Date().toISOString(),
      };

      await product.addReview(newReview);
      return this._formatProduct(product);
    } catch (error) {
      throw error;
    }
  }

  async updateStock(productId, newStock) {
    try {
      const product = await this.Model.findByIdAndUpdate(
        productId,
        { stock: newStock },
        { new: true },
      );
      return this._formatProduct(product);
    } catch (error) {
      throw error;
    }
  }
}

export default new ProductModel();
