/**
 * Shipping rates — the single source of truth for what delivery costs.
 * Mirrored in Frontend/src/utils/shipping.js (keep the two in step) and
 * described to customers on the Shipping Policy page.
 *
 * - Israel: ₪30, free when the order (after discounts, before shipping)
 *   reaches ₪300.
 * - Abroad: flat rate per region; the free-shipping threshold applies to
 *   Israel only, as the policy states.
 */

export const FREE_SHIPPING_THRESHOLD = 300;

export const SHIPPING_ZONES = {
  IL: { price: 30, freeOver: FREE_SHIPPING_THRESHOLD },
  EUROPE: { price: 150, freeOver: null },
  NORTH_AMERICA: { price: 180, freeOver: null },
  WORLD: { price: 200, freeOver: null },
};

const EUROPE = new Set([
  "AD", "AL", "AT", "BA", "BE", "BG", "BY", "CH", "CY", "CZ", "DE", "DK", "EE",
  "ES", "FI", "FO", "FR", "GB", "GG", "GI", "GR", "HR", "HU", "IE", "IM", "IS",
  "IT", "JE", "LI", "LT", "LU", "LV", "MC", "MD", "ME", "MK", "MT", "NL", "NO",
  "PL", "PT", "RO", "RS", "SE", "SI", "SK", "SM", "UA", "VA", "XK",
]);

const NORTH_AMERICA = new Set(["US", "CA"]);

/** Normalise whatever the client sent to an ISO 3166-1 alpha-2 code. */
export function normalizeCountry(country) {
  if (typeof country !== "string") return "IL";
  const value = country.trim();
  if (!value || value === "ישראל" || /^israel$/i.test(value)) return "IL";
  const code = value.toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : "IL";
}

export function shippingZone(countryCode) {
  if (countryCode === "IL") return "IL";
  if (EUROPE.has(countryCode)) return "EUROPE";
  if (NORTH_AMERICA.has(countryCode)) return "NORTH_AMERICA";
  return "WORLD";
}

/**
 * @param {string} countryCode ISO alpha-2
 * @param {number} orderTotal  total after discounts, before shipping
 * @returns {{ zone: string, price: number, free: boolean }}
 */
export function quoteShipping(countryCode, orderTotal) {
  const zone = shippingZone(countryCode);
  const { price, freeOver } = SHIPPING_ZONES[zone];
  const free = freeOver != null && orderTotal >= freeOver;
  return { zone, price: free ? 0 : price, free };
}
