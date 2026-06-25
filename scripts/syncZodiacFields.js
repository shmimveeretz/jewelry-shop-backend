import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import ProductMongo from "../src/models/ProductMongo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productsPath = path.join(__dirname, "../../Products.products.json");

dotenv.config({ path: path.join(__dirname, "../.env") });

const products = JSON.parse(fs.readFileSync(productsPath, "utf8"));

function buildZodiacUpdate(product) {
  const update = {};
  if (product.zodiacSign) update.zodiacSign = product.zodiacSign;
  if (product.zodiacSignEn) update.zodiacSignEn = product.zodiacSignEn;
  if (product.zodiac) update.zodiac = product.zodiac;
  if (product.zodiacEn) update.zodiacEn = product.zodiacEn;
  if (Array.isArray(product.zodiacSigns) && product.zodiacSigns.length) {
    update.zodiacSigns = product.zodiacSigns;
  }
  if (Array.isArray(product.zodiacSignsEn) && product.zodiacSignsEn.length) {
    update.zodiacSignsEn = product.zodiacSignsEn;
  }
  return Object.keys(update).length ? update : null;
}

async function syncMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("MONGODB_URI not set — skipped MongoDB sync.");
    return;
  }

  await mongoose.connect(uri);
  let updated = 0;

  for (const product of products) {
    const update = buildZodiacUpdate(product);
    if (!update) continue;

    const result = await ProductMongo.updateOne(
      { id: product.id },
      { $set: update },
    );
    if (result.modifiedCount > 0) updated += 1;
  }

  console.log(`Synced zodiac fields on ${updated} products in MongoDB.`);
  await mongoose.disconnect();
}

syncMongo().catch((err) => {
  console.error("MongoDB sync failed:", err.message);
  process.exitCode = 1;
});
