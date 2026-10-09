import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FREE_SHIPPING_THRESHOLD,
  normalizeCountry,
  quoteShipping,
  shippingZone,
} from "../src/utils/shipping.js";

test("Israel: ₪30 below the threshold, free from ₪300", () => {
  assert.equal(FREE_SHIPPING_THRESHOLD, 300);
  assert.deepEqual(quoteShipping("IL", 299), { zone: "IL", price: 30, free: false });
  assert.deepEqual(quoteShipping("IL", 300), { zone: "IL", price: 0, free: true });
  assert.deepEqual(quoteShipping("IL", 0), { zone: "IL", price: 30, free: false });
});

test("abroad: flat rate per zone, never free", () => {
  assert.equal(quoteShipping("DE", 5000).price, 150);
  assert.equal(quoteShipping("GB", 100).price, 150);
  assert.equal(quoteShipping("US", 5000).price, 180);
  assert.equal(quoteShipping("CA", 100).price, 180);
  assert.equal(quoteShipping("JP", 5000).price, 200);
  assert.equal(quoteShipping("AU", 5000).free, false);
});

test("zones", () => {
  assert.equal(shippingZone("IL"), "IL");
  assert.equal(shippingZone("FR"), "EUROPE");
  assert.equal(shippingZone("US"), "NORTH_AMERICA");
  assert.equal(shippingZone("BR"), "WORLD");
});

test("country input is normalised; anything unrecognisable is Israel", () => {
  assert.equal(normalizeCountry("ישראל"), "IL");
  assert.equal(normalizeCountry("Israel"), "IL");
  assert.equal(normalizeCountry(" de "), "DE");
  assert.equal(normalizeCountry(""), "IL");
  assert.equal(normalizeCountry(undefined), "IL");
  assert.equal(normalizeCountry({ $ne: "IL" }), "IL");
  assert.equal(normalizeCountry("Germany"), "IL");
});
