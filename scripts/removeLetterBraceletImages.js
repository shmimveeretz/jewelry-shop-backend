import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import ProductMongo from "../src/models/ProductMongo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productsPath = path.join(__dirname, "../../Products.products.json");

dotenv.config({ path: path.join(__dirname, "../.env") });

const BRACELET_URL_PATTERNS = [
  /Letter_Bracelet/i,
  /Letters_Bracelet/i,
  /Letters__Bracelet/i,
];

function stripBraceletImages(images = []) {
  return images.filter(
    (url) => !BRACELET_URL_PATTERNS.some((pattern) => pattern.test(url)),
  );
}

const products = JSON.parse(fs.readFileSync(productsPath, "utf8"));
let jsonUpdated = 0;

for (const product of products) {
  if (product.category !== "אותיות עבריות" || !product.letter) continue;

  const nextImages = stripBraceletImages(product.images);
  if (nextImages.length !== (product.images?.length ?? 0)) {
    product.images = nextImages;
    jsonUpdated += 1;
  }
}

if (jsonUpdated > 0) {
  fs.writeFileSync(productsPath, JSON.stringify(products, null, 2) + "\n");
}
console.log(
  `Removed bracelet images from ${jsonUpdated} single-letter products in Products.products.json`,
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
    if (product.category !== "אותיות עבריות" || !product.letter) continue;

    const nextImages = stripBraceletImages(product.images);
    const result = await ProductMongo.updateOne(
      { id: product.id },
      { $set: { images: nextImages } },
    );
    if (result.modifiedCount > 0) dbUpdated += 1;
  }

  console.log(`Synced ${dbUpdated} single-letter products in MongoDB.`);
  await mongoose.disconnect();
}

syncMongo().catch((err) => {
  console.error("MongoDB sync failed:", err.message);
  process.exitCode = 1;
});
