import ProductMongo from "../models/ProductMongo.js";
import CouponMongo from "../models/CouponMongo.js";
import { normalizeCountry, quoteShipping } from "./shipping.js";
import {
  getExtraLetterPerBraceletCost,
  formatItemNameWithExtraLetters,
  normalizeExtraHebrewLetters,
  isHebrewLetterProduct,
} from "./extraHebrewLetters.js";

/**
 * Server-side mirror of Frontend/src/utils/productPricing.js.
 *
 * The browser shows prices, but the amount sent to PayPlus is always rebuilt
 * here from the database. Any price, total or discount in the request body is
 * ignored, so a tampered cart can never lower what the customer is charged.
 * Keep the two files in step when pricing rules change.
 */

export const GIFT_WRAP_PRODUCT_ID = "gift-wrap";
export const GIFT_WRAP_PRICE = 15;
const GIFT_WRAP_NAME = "אריזת מתנה יוקרתית";

const MAX_QUANTITY = 20;
const MAX_LINE_ITEMS = 50;
const LETTER_CHAIN_PRODUCT_ID = "letter-chain";

const isBracelet = (type) =>
  typeof type === "string" && type.startsWith("צמיד");
const isNecklace = (type) =>
  typeof type === "string" && type.startsWith("שרשרת");

function resolveJewelryTypeKey(jewelryType) {
  if (isBracelet(jewelryType)) return "צמיד";
  if (isNecklace(jewelryType)) return "שרשרת";
  return jewelryType;
}

function getLengthAddition(priceAdditions, jewelryType, length, isHebrewLetters) {
  if (!length) return 0;
  const lengthVal = priceAdditions?.length;
  const nested = Boolean(lengthVal?.["שרשרת"] || lengthVal?.["צמיד"]);

  if (isHebrewLetters && jewelryType && nested) {
    const table = lengthVal?.[resolveJewelryTypeKey(jewelryType)];
    return table?.[length] ?? table?.[Number(length)] ?? 0;
  }
  return lengthVal?.[length] ?? lengthVal?.[Number(length)] ?? 0;
}

function allowsExtraLetters(product, jewelryType) {
  if (product?.id === LETTER_CHAIN_PRODUCT_ID) return Boolean(jewelryType);
  if (isHebrewLetterProduct(product)) return true;
  if (!product?.priceAdditions?.extraLetterForBracelet) return false;
  return isBracelet(jewelryType);
}

const toNumber = (value) => (typeof value === "number" && isFinite(value) ? value : 0);

/** Unit price for a product with the given option choices, from DB data only. */
export function calculateUnitPrice(product, selectedOptions = {}, extraLetters = []) {
  const priceAdditions = product?.priceAdditions || {};
  const isHebrewLetters = isHebrewLetterProduct(product);
  let total = toNumber(product.price);

  for (const key of Object.keys(priceAdditions)) {
    const table = priceAdditions[key];
    if (typeof table !== "object" || table === null) continue;
    if (key === "length" || key === "extraLetterForBracelet") continue;
    const selected = selectedOptions[key];
    if (typeof selected === "string" && selected) {
      total += toNumber(table[selected]);
    }
  }

  total += toNumber(
    getLengthAddition(
      priceAdditions,
      selectedOptions.jewelryType,
      selectedOptions.length,
      isHebrewLetters,
    ),
  );

  if (allowsExtraLetters(product, selectedOptions.jewelryType) && extraLetters.length > 0) {
    total +=
      extraLetters.length *
      toNumber(getExtraLetterPerBraceletCost(priceAdditions, selectedOptions.metalType));
  }

  return total;
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value) return value.slice(0, 100);
  }
  return "";
}

/**
 * Validate a coupon code against the database.
 * Returns { code, discountPercent } or null when the code is unknown/inactive.
 */
export async function resolveCoupon(code) {
  if (typeof code !== "string" || !code.trim()) return null;
  const coupon = await CouponMongo.findOne({
    code: code.trim().toUpperCase().slice(0, 64),
  });
  if (!coupon || coupon.unavailableReason()) return null;
  const discountPercent = Math.min(Math.max(Number(coupon.discountPercent) || 0, 0), 100);
  return { code: coupon.code, discountPercent };
}

/**
 * Rebuild a cart from client input using database prices.
 *
 * @param {Array} rawItems - [{ productId, quantity, selectedOptions, selections }]
 * @param {string|null} couponCode
 * @param {{ country?: string }} [options] - destination, for shipping
 * @returns {Promise<{ items, itemsPrice, subtotal, shipping, totalPrice, coupon }>}
 *   items[].price is the discounted unit price actually charged; subtotal is
 *   the goods after discount; totalPrice adds shipping.
 * @throws Error with `statusCode = 400` on invalid input.
 */
export async function priceCart(rawItems, couponCode, { country } = {}) {
  const fail = (message) => {
    const err = new Error(message);
    err.statusCode = 400;
    return err;
  };

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw fail("העגלה ריקה");
  }
  if (rawItems.length > MAX_LINE_ITEMS) {
    throw fail("יותר מדי פריטים בהזמנה");
  }

  const coupon = await resolveCoupon(couponCode);
  if (couponCode && !coupon) {
    throw fail("קוד קופון לא תקין או פג תוקף");
  }
  const multiplier = coupon ? 1 - coupon.discountPercent / 100 : 1;

  const productIds = [
    ...new Set(
      rawItems
        .map((item) => item?.productId)
        .filter((id) => typeof id === "string" && id !== GIFT_WRAP_PRODUCT_ID),
    ),
  ];
  const products = await ProductMongo.find({ id: { $in: productIds } }).lean();
  const productsById = new Map(products.map((p) => [p.id, p]));

  let itemsPrice = 0;
  let totalPrice = 0;
  let giftWrapAdded = false;

  const items = [];
  for (const raw of rawItems) {
    const productId = typeof raw?.productId === "string" ? raw.productId : "";
    const quantity = Math.floor(Number(raw?.quantity) || 1);
    if (quantity < 1 || quantity > MAX_QUANTITY) {
      throw fail("כמות לא תקינה");
    }

    if (productId === GIFT_WRAP_PRODUCT_ID) {
      if (giftWrapAdded) continue;
      giftWrapAdded = true;
      const price = Math.round(GIFT_WRAP_PRICE * multiplier);
      itemsPrice += GIFT_WRAP_PRICE;
      totalPrice += price;
      items.push({
        productId,
        name: GIFT_WRAP_NAME,
        price,
        quantity: 1,
        selectedOptions: {},
        selections: {},
      });
      continue;
    }

    const product = productsById.get(productId);
    if (!product || product.status === "inactive") {
      throw fail("אחד המוצרים בעגלה אינו זמין יותר");
    }

    const options = { ...(raw.selections || {}), ...(raw.selectedOptions || {}) };
    const selectedOptions = {};
    for (const [key, value] of Object.entries(options)) {
      if (key !== "extraLetters" && typeof value === "string") {
        selectedOptions[key] = value.slice(0, 100);
      }
    }

    const extraLetters = allowsExtraLetters(product, selectedOptions.jewelryType)
      ? normalizeExtraHebrewLetters(
          raw.selections?.extraLetters ?? raw.selectedOptions?.extraLetters ?? [],
        )
      : [];

    const unitPrice = calculateUnitPrice(product, selectedOptions, extraLetters);
    const chargedPrice = Math.round(unitPrice * multiplier);

    itemsPrice += unitPrice * quantity;
    totalPrice += chargedPrice * quantity;

    items.push({
      productId,
      name: formatItemNameWithExtraLetters(product.name, extraLetters),
      price: chargedPrice,
      quantity,
      selectedOptions,
      selections: {
        metalType: pickString(selectedOptions.metalType),
        length: pickString(selectedOptions.length),
        jewelryType: pickString(selectedOptions.jewelryType),
        extraLetters,
      },
    });
  }

  if (totalPrice <= 0) {
    throw fail("סכום ההזמנה אינו תקין");
  }

  const subtotal = Math.round(totalPrice * 100) / 100;
  const countryCode = normalizeCountry(country);
  const shipping = { country: countryCode, ...quoteShipping(countryCode, subtotal) };

  return {
    items,
    itemsPrice: Math.round(itemsPrice * 100) / 100,
    subtotal,
    shipping,
    totalPrice: Math.round((subtotal + shipping.price) * 100) / 100,
    coupon,
  };
}
