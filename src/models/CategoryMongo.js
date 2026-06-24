import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    nameHe: { type: String, required: true },
    nameEn: { type: String, default: "" },
    descriptionHe: { type: String, default: "" },
    descriptionEn: { type: String, default: "" },
    sourceHe: { type: String, default: "" },
    sourceEn: { type: String, default: "" },
    image: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "categories" },
);

export default mongoose.model("Category", CategorySchema);
