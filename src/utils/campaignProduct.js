import mongoose from "mongoose";
import ProductMongo from "../models/ProductMongo.js";

/**
 * Shared product projection for campaign traffic, used by both the legacy
 * /api/campaign/products/:id endpoint and the DPP bootstrap. Keeping one copy
 * means a field added for a new block shows up in both without drift.
 *
 * Paid traffic is measured in milliseconds, so the payload stays as small as
 * the layout allows.
 */
export const CAMPAIGN_FIELDS = [
  "id",
  "name",
  "category",
  "description",
  "price",
  "priceAdditions",
  "images",
  "letter",
  "meaningHe",
  "quoteHe",
  "sourceHe",
  "gematria",
  "stock",
  "status",
  "rating",
  "reviews",
].join(" ");

/** Reviews are social proof, not an archive — a few recent ones is enough. */
export const MAX_REVIEWS = 4;

const normalizeImage = (img) => {
  if (!img) return null;
  return typeof img === "string" ? img : img.url || null;
};

/** Products are addressed by their slug `id`; older links may use the ObjectId. */
export const findCampaignProduct = async (id) => {
  const product = await ProductMongo.findOne({ id: String(id) })
    .select(CAMPAIGN_FIELDS)
    .lean();

  if (product || !mongoose.Types.ObjectId.isValid(id)) return product;

  return ProductMongo.findById(id).select(CAMPAIGN_FIELDS).lean();
};

export const shapeCampaignProduct = (product, maxReviews = MAX_REVIEWS) => {
  const reviews = (product.reviews || [])
    .filter((review) => review.comment)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, maxReviews)
    .map(({ rating, comment, date }) => ({ rating, comment, date }));

  return {
    id: product.id,
    name: product.name,
    category: product.category,
    description: product.description,
    price: product.price,
    priceAdditions: product.priceAdditions || {},
    images: (product.images || []).map(normalizeImage).filter(Boolean),
    letter: product.letter,
    meaningHe: product.meaningHe,
    quoteHe: product.quoteHe,
    sourceHe: product.sourceHe,
    gematria: product.gematria,
    stock: product.stock ?? 0,
    rating: product.rating || { average: 0, count: 0 },
    reviews,
  };
};
