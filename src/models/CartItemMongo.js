import mongoose from "mongoose";

// Hebrew letters: Unicode U+05D0 (א) – U+05EA (ת)
const HEBREW_LETTER_RE = /^[\u05D0-\u05EA]$/;

/**
 * Reusable selections sub-schema.
 * Exported so OrderMongo and CartItemMongo share the same shape.
 */
export const selectionsSchema = new mongoose.Schema(
  {
    metalType: { type: String, default: "" },
    length: { type: String, default: "" },
    jewelryType: { type: String, default: "" },
    extraLetters: {
      type: [String],
      default: [],
      validate: {
        validator: (letters) => letters.every((l) => HEBREW_LETTER_RE.test(l)),
        message:
          "extraLetters מכיל אותיות לא חוקיות — ניתן להשתמש באותיות עבריות בלבד (א–ת)",
      },
    },
  },
  { _id: false },
);

/**
 * Exported sub-schema for embedding cart items inside other documents
 * (e.g. user cart array, order items).
 */
export const cartItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, default: 1, min: 1 },
    selections: { type: selectionsSchema, default: () => ({}) },
  },
  { _id: false },
);

/**
 * Persistent server-side cart collection (optional).
 * Documents expire automatically after 7 days (TTL index on createdAt).
 * Guests are identified by sessionId; registered users by userId.
 */
const CartSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    sessionId: { type: String, index: true },
    items: [cartItemSchema],
    createdAt: { type: Date, default: Date.now, expires: 604800 }, // TTL: 7 days
  },
  { collection: "carts" },
);

export default mongoose.model("Cart", CartSchema);
