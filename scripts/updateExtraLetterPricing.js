import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import ProductMongo from "../src/models/ProductMongo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productsPath = path.join(__dirname, "../../Products.products.json");

dotenv.config({ path: path.join(__dirname, "../.env") });

const EXTRA_LETTER_BY_METAL = {
  "כסף 925": 90,
  "ציפוי זהב": 120,
  "זהב 14 קראט": 240,
};

const products = JSON.parse(fs.readFileSync(productsPath, "utf8"));
let jsonUpdated = 0;

for (const product of products) {
  if (product.category !== "אותיות עבריות") continue;
  if (!product.priceAdditions) product.priceAdditions = {};

  product.priceAdditions.extraLetterForBracelet = { ...EXTRA_LETTER_BY_METAL };
  jsonUpdated += 1;
}

fs.writeFileSync(productsPath, JSON.stringify(products, null, 2) + "\n");
console.log(
  `Updated extraLetterForBracelet on ${jsonUpdated} Hebrew letter products in Products.products.json`,
);

async function syncMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("MONGODB_URI not set — skipped MongoDB sync.");
    return;
  }

  await mongoose.connect(uri);
  let dbUpdated = 0;

  for (const product of products) {
    if (product.category !== "אותיות עבריות") continue;

    const result = await ProductMongo.updateOne(
      { id: product.id },
      {
        $set: {
          "priceAdditions.extraLetterForBracelet": EXTRA_LETTER_BY_METAL,
        },
      },
    );
    if (result.modifiedCount > 0 || result.matchedCount > 0) dbUpdated += 1;
  }

  console.log(`Synced ${dbUpdated} Hebrew letter products in MongoDB.`);
  await mongoose.disconnect();
}

syncMongo().catch((err) => {
  console.error("MongoDB sync failed:", err.message);
  process.exitCode = 1;
});
