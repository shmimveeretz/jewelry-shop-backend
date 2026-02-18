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
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    priceAdditions: {
      type: Map,
      of: Number,
    },
    metalType: {
      type: Map,
      of: Number,
    },
    length: {
      type: Map,
      of: Number,
    },
    metals: [String],
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
