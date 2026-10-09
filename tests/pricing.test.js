import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { calculateUnitPrice } from "../src/utils/orderPricing.js";

/*
 * The server recomputes every price before charging (orderPricing.js), and
 * the storefront shows prices with its own copy of the rules
 * (Frontend/src/utils/productPricing.js). If the two drift, customers see one
 * price and pay another. These tests pin the rules and the parity.
 */

const letter = {
  id: "aleph",
  category: "אותיות עבריות",
  price: 360,
  priceAdditions: {
    metalType: { "כסף 925": 0, "ציפוי זהב": 50, "זהב 14 קראט": 3360 },
    length: { 40: 0, 45: 0, 50: 20 },
  },
};

const letterChain = {
  id: "letter-chain",
  category: "אותיות עבריות",
  price: 390,
  priceAdditions: {
    jewelryType: { שרשרת: 0, צמיד: 0 },
    metalType: { "כסף 925": 0, "ציפוי זהב": 50 },
    length: {
      שרשרת: { 40: 0, 45: 10, 50: 30 },
      צמיד: { 16: 0, 18: 5 },
    },
    extraLetterForBracelet: { "כסף 925": 60, "ציפוי זהב": 80 },
  },
};

const pendant = {
  id: "harp",
  category: "סמלי בני ישראל",
  price: 440,
  priceAdditions: { metalType: { "כסף 925": 0, "ציפוי זהב": 50 } },
};

test("base price with no options", () => {
  assert.equal(calculateUnitPrice(pendant, {}), 440);
});

test("option additions are added", () => {
  assert.equal(calculateUnitPrice(pendant, { metalType: "ציפוי זהב" }), 490);
  assert.equal(calculateUnitPrice(letter, { metalType: "זהב 14 קראט", length: "50" }), 3740);
});

test("unknown option values add nothing (a tampered cart can't lower or break the price)", () => {
  assert.equal(calculateUnitPrice(pendant, { metalType: "plutonium" }), 440);
  assert.equal(calculateUnitPrice(pendant, { metalType: { $gt: 0 } }), 440);
});

test("letter chain: length table is per jewelry type", () => {
  assert.equal(
    calculateUnitPrice(letterChain, { jewelryType: "שרשרת", metalType: "כסף 925", length: "50" }),
    420,
  );
  assert.equal(
    calculateUnitPrice(letterChain, { jewelryType: "צמיד", metalType: "כסף 925", length: "18" }),
    395,
  );
});

test("extra letters are charged per letter at the metal's rate", () => {
  const options = { jewelryType: "צמיד", metalType: "ציפוי זהב", length: "16" };
  assert.equal(calculateUnitPrice(letterChain, options, ["ב", "ג"]), 390 + 50 + 2 * 80);
  // The per-letter table itself is never summed as an ordinary option
  assert.equal(calculateUnitPrice(letterChain, options, []), 440);
});

/** Load the storefront's pricing module (extensionless Vite imports) in Node */
async function loadFrontendPricing() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = path.resolve(here, "../../Frontend/src");
  if (!fs.existsSync(path.join(src, "utils/productPricing.js"))) return null;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pricing-parity-"));
  // Copy the plain-JS folders the pricing module draws on, adding the ".js"
  // extensions Vite lets the source leave out
  for (const dir of ["utils", "data", "constants"]) {
    const from = path.join(src, dir);
    if (!fs.existsSync(from)) continue;
    fs.mkdirSync(path.join(tmp, dir), { recursive: true });
    for (const file of fs.readdirSync(from).filter((f) => f.endsWith(".js"))) {
      const code = fs
        .readFileSync(path.join(from, file), "utf8")
        .replace(/from\s+"(\.{1,2}\/[\w./-]+?)(?<!\.js)"/g, 'from "$1.js"');
      fs.writeFileSync(path.join(tmp, dir, file), code);
    }
  }
  return import(pathToFileURL(path.join(tmp, "utils/productPricing.js")).href);
}

test("storefront and server compute the same price for every option combination", async (t) => {
  const frontend = await loadFrontendPricing();
  if (!frontend) {
    t.skip("Frontend checkout not found next to Backend");
    return;
  }

  const cases = [];
  for (const product of [letter, letterChain, pendant]) {
    const pa = product.priceAdditions;
    const metals = Object.keys(pa.metalType || { "": 0 });
    const types = Object.keys(pa.jewelryType || { "": 0 });
    for (const metalType of metals) {
      for (const jewelryType of types) {
        const lengthTable =
          pa.length && (pa.length.שרשרת || pa.length.צמיד)
            ? pa.length[jewelryType] || {}
            : pa.length || {};
        const lengths = Object.keys(lengthTable).length ? Object.keys(lengthTable) : [""];
        for (const length of lengths) {
          for (const extra of [[], ["ב"], ["ב", "ג", "ד"]]) {
            const options = {};
            if (metalType) options.metalType = metalType;
            if (jewelryType) options.jewelryType = jewelryType;
            if (length) options.length = length;
            cases.push([product, options, extra]);
          }
        }
      }
    }
  }

  for (const [product, options, extra] of cases) {
    assert.equal(
      frontend.calculateProductPrice(product, options, extra),
      calculateUnitPrice(product, options, extra),
      `${product.id} ${JSON.stringify(options)} +${extra.length} letters`,
    );
  }
  assert.ok(cases.length > 40);
});
