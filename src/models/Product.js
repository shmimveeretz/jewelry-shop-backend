import ProductMongo from "./ProductMongo.js";

class ProductModel {
  constructor() {
    this.Model = ProductMongo;
  }

  _formatProduct(product) {
    if (!product) return null;
    return {
      id: product.id,
      name: product.name,
      nameEn: product.nameEn,
      letter: product.letter,
      category: product.category,
      price: product.price,
      priceAdditions: product.priceAdditions,
      metalType: product.metalType,
      length: product.length,
      metals: product.metals,
      images: product.images,
      description: product.description,
      meaningHe: product.meaningHe,
      gematria: product.gematria,
      types: product.types,
      stock: product.stock,
      featured: product.featured,
      rating: product.rating,
      reviews: product.reviews,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  async create(productData) {
    try {
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
      const product = await this.Model.findOne({ id: id });
      return this._formatProduct(product);
    } catch (error) {
      throw new Error(`Failed to fetch product: ${error.message}`);
    }
  }

  async update(id, productData) {
    try {
      const product = await this.Model.findOneAndUpdate(
        { id: id },
        productData,
        { new: true },
      );
      return this._formatProduct(product);
    } catch (error) {
      throw new Error(`Failed to update product: ${error.message}`);
    }
  }

  async delete(id) {
    try {
      const product = await this.Model.findOneAndDelete({ id: id });
      return this._formatProduct(product);
    } catch (error) {
      throw new Error(`Failed to delete product: ${error.message}`);
    }
  }

  async addReview(productId, reviewData) {
    try {
      const product = await this.Model.findOne({ id: productId });
      if (!product) throw new Error("Product not found");

      product.reviews.push({
        userId: reviewData.userId,
        rating: reviewData.rating,
        comment: reviewData.comment,
        date: new Date(),
      });

      // Recalculate rating
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
