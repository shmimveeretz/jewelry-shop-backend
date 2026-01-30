import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "נא להזין שם מוצר"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "נא להזין תיאור מוצר"],
    },
    price: {
      type: Number,
      required: [true, "נא להזין מחיר"],
      min: [0, "המחיר חייב להיות חיובי"],
    },
    discountPrice: {
      type: Number,
      default: null,
    },
    category: {
      type: String,
      required: [true, "נא לבחור קטגוריה"],
      enum: ["מגן דוד", "חי", "חמסה", "מזוזה", "אותיות", "אחר"],
    },
    images: [
      {
        url: String,
        alt: String,
      },
    ],
    metals: [String],
    lengths: [String],
    chains: [String],
    waxColors: [String],
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "המלאי לא יכול להיות שלילי"],
    },
    zodiacSign: {
      type: String,
      enum: [
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
      ],
      default: "כללי",
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    rating: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      count: {
        type: Number,
        default: 0,
      },
    },
    reviews: [
      {
        user: String,
        name: {
          type: String,
          required: true,
        },
        rating: {
          type: Number,
          required: true,
          min: 1,
          max: 5,
        },
        comment: {
          type: String,
          required: true,
        },
        date: {
          type: String,
          default: () => new Date().toISOString(),
        },
      },
    ],
    featured: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Update stock method
productSchema.methods.updateStock = async function (quantity) {
  if (this.stock < quantity) {
    throw new Error("אין מספיק מלאי");
  }
  this.stock -= quantity;
  this.isAvailable = this.stock > 0;
  await this.save();
  return this;
};

// Add review method
productSchema.methods.addReview = async function (review) {
  this.reviews.push(review);

  // Recalculate rating
  const sum = this.reviews.reduce((acc, item) => item.rating + acc, 0);
  this.rating = {
    average: sum / this.reviews.length,
    count: this.reviews.length,
  };

  await this.save();
  return this;
};

const Product = mongoose.model("Product", productSchema);

export default Product;
