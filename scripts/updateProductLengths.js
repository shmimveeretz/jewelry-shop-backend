import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
const productsPath = join(root, "Products.products.json");

const NECKLACE_LENGTHS = ["39", "40", "42", "45", "47", "50"];
const BRACELET_LENGTHS = ["15", "16", "17", "18", "19"];

function zeroMap(sizes) {
  return Object.fromEntries(sizes.map((s) => [s, 0]));
}

const products = JSON.parse(readFileSync(productsPath, "utf8"));

let updated = 0;
for (const product of products) {
  const pa = product.priceAdditions;
  if (!pa?.length) continue;

  const lengthVal = pa.length;

  if (lengthVal["שרשרת"] || lengthVal["צמיד"]) {
    pa.length = {
      שרשרת: zeroMap(NECKLACE_LENGTHS),
      צמיד: zeroMap(BRACELET_LENGTHS),
    };
    updated++;
  } else if (typeof lengthVal === "object" && !Array.isArray(lengthVal)) {
    pa.length = zeroMap(NECKLACE_LENGTHS);
    updated++;
  }
}

writeFileSync(productsPath, JSON.stringify(products, null, 2), "utf8");
console.log(
  `Updated length options on ${updated} products in Products.products.json`,
);
