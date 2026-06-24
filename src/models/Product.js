import mongoose from "mongoose";
import ProductMongo from "./ProductMongo.js";

class ProductModel {
  constructor() {
    this.Model = ProductMongo;
  }

  _normalizeImage(img) {
    if (!img) return null;
    return typeof img === "string" ? img : img.url || null;
  }

  _formatProduct(product) {
    if (!product) return null;

    const images = (product.images || [])
      .map((img) => this._normalizeImage(img))
      .filter(Boolean);

    return {
      _id: product._id,
      id: product.id,
      name: product.name,
      nameEn: product.nameEn,
      letter: product.letter,
      category: product.category,
      categoryEn: product.categoryEn,
      price: product.price,
      priceAdditions: product.priceAdditions || {},
      images,
      description: product.description,
      descriptionEn: product.descriptionEn,
      meaningHe: product.meaningHe,
      gematria: product.gematria,
      types: product.types,
      metals: product.metals,
      stock: product.stock,
      discountPrice: product.discountPrice,
      status: product.status || "active",
      featured: product.featured,
      rating: product.rating,
      reviews: product.reviews,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  async _resolveQuery(id) {
    if (!id) return null;
    let product = await this.Model.findOne({ id: String(id) });
    if (!product && mongoose.Types.ObjectId.isValid(id)) {
      product = await this.Model.findById(id);
    }
    return product;
  }

  async _generateUniqueId(name) {
    const base =
      (name || "product")
        .trim()
        .toLowerCase()
        .replace(/[^\w\u0590-\u05FF]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || `prod-${Date.now()}`;

    let candidate = base;
    let counter = 1;
    while (await this.Model.findOne({ id: candidate })) {
      candidate = `${base}-${counter++}`;
    }
    return candidate;
  }

  async create(productData) {
    try {
      if (!productData.id) {
        productData.id = await this._generateUniqueId(productData.name);
      }
      const newProduct = await this.Model.create(productData);
      return this._formatProduct(newProduct);
    } catch (error) {
      throw new Error(`Failed to create product: ${error.message}`);
    }
  }

  async findAll(filter = {}) {
    try {
      const products = await this.Model.find(filter);
      return products.map((p) => this._formatProduct(p));
    } catch (error) {
      throw new Error(`Failed to fetch products: ${error.message}`);
    }
  }

  async findById(id) {
    try {
      const product = await this._resolveQuery(id);
      return this._formatProduct(product);
    } catch (error) {
      throw new Error(`Failed to fetch product: ${error.message}`);
    }
  }

  async update(id, productData) {
    try {
      const existing = await this._resolveQuery(id);
      if (!existing) return null;

      const product = await this.Model.findOneAndUpdate(
        { _id: existing._id },
        { ...productData, updatedAt: new Date() },
        { new: true },
      );
      return this._formatProduct(product);
    } catch (error) {
      throw new Error(`Failed to update product: ${error.message}`);
    }
  }

  async delete(id) {
    try {
      const existing = await this._resolveQuery(id);
      if (!existing) return null;

      const product = await this.Model.findOneAndDelete({ _id: existing._id });
      return this._formatProduct(product);
    } catch (error) {
      throw new Error(`Failed to delete product: ${error.message}`);
    }
  }

  async addReview(productId, reviewData) {
    try {
      const product = await this._resolveQuery(productId);
      if (!product) throw new Error("Product not found");

      product.reviews.push({
        userId: reviewData.userId,
        rating: reviewData.rating,
        comment: reviewData.comment,
        date: new Date(),
      });

      const ratings = product.reviews.map((r) => r.rating);
      product.rating.average = ratings.reduce((a, b) => a + b) / ratings.length;
      product.rating.count = ratings.length;

      await product.save();
      return this._formatProduct(product);
    } catch (error) {
      throw new Error(`Failed to add review: ${error.message}`);
    }
  }
}

export default new ProductModel();
