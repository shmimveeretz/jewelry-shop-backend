import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import ProductMongo from "../src/models/ProductMongo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productsPath = path.join(__dirname, "../../Products.products.json");

dotenv.config({ path: path.join(__dirname, "../.env") });

const BRACELET_GOLD =
  "https://res.cloudinary.com/dhayarvh3/image/upload/f_auto,q_auto/Letter_Bracelet_Gold.jpg";
const BRACELET_SILVER =
  "https://res.cloudinary.com/dhayarvh3/image/upload/f_auto,q_auto/Letters__Bracelet_Silver_2.jpg";

const BRACELET_IMAGES = [BRACELET_GOLD, BRACELET_SILVER];

function appendBraceletImages(images = []) {
  const next = [...images];
  for (const url of BRACELET_IMAGES) {
    if (!next.includes(url)) next.push(url);
  }
  return next;
}

const products = JSON.parse(fs.readFileSync(productsPath, "utf8"));
let jsonUpdated = 0;

for (const product of products) {
  if (product.category !== "אותיות עבריות") continue;

  const nextImages = appendBraceletImages(product.images);
  if (nextImages.length !== (product.images?.length ?? 0)) {
    product.images = nextImages;
    jsonUpdated += 1;
  }
}

fs.writeFileSync(productsPath, JSON.stringify(products, null, 2) + "\n");
console.log(
  `Updated ${jsonUpdated} Hebrew letter products in Products.products.json`,
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

    const nextImages = appendBraceletImages(product.images);
    const result = await ProductMongo.updateOne(
      { id: product.id },
      { $set: { images: nextImages } },
    );
    if (result.modifiedCount > 0) dbUpdated += 1;
  }

  console.log(`Synced ${dbUpdated} Hebrew letter products in MongoDB.`);
  await mongoose.disconnect();
}

syncMongo().catch((err) => {
  console.error("MongoDB sync failed:", err.message);
  process.exitCode = 1;
});
