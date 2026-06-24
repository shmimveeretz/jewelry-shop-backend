import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    nameEn: {
      type: String,
    },
    letter: {
      type: String,
    },
    category: {
      type: String,
      required: true,
    },
    categoryEn: {
      type: String,
    },
    descriptionEn: {
      type: String,
    },
    discountPrice: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    metals: [String],
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    priceAdditions: {
      type: Object,
      default: {},
    },
    metalType: {
      type: Map,
      of: Number,
    },
    length: {
      type: Map,
      of: Number,
    },
    images: [String], // Array of Cloudinary URLs
    description: {
      type: String,
      required: true,
    },
    meaningHe: {
      type: String,
    },
    gematria: {
      type: Number,
    },
    types: [String], // e.g., ["תליון", "טבעת"]
    stock: {
      type: Number,
      default: 0,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    rating: {
      average: {
        type: Number,
        default: 0,
      },
      count: {
        type: Number,
        default: 0,
      },
    },
    reviews: [
      {
        userId: mongoose.Schema.Types.ObjectId,
        rating: Number,
        comment: String,
        date: Date,
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: "products" },
);

export default mongoose.model("Product", ProductSchema);
