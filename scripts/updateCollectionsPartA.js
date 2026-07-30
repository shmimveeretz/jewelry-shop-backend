/**
 * Part A migration:
 * - Rename category שילת → סמלי בני ישראל
 * - Add quote/source fields to סמלי בני ישראל products
 * - Set sortOrder on כוכבים products
 * - Rename שלישיות display nameHe → כוכב, מזל ואבן חושן
 *
 * Usage: node Backend/scripts/updateCollectionsPartA.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import ProductMongo from "../src/models/ProductMongo.js";
import CategoryMongo from "../src/models/CategoryMongo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productsPath = path.join(__dirname, "../../Products.products.json");

dotenv.config({ path: path.join(__dirname, "../.env") });

const STAR_SORT_ORDER = {
  maadim: 1,
  venus: 2,
  "kochav-chama": 3,
  yareach: 4,
  shemesh: 5,
  tzedek: 6,
  saturn: 7,
};

const SYMBOL_QUOTES = {
  chai: {
    quoteHe: "וּבָחַרְתָּ בַּחַיִּים לְמַעַן תִּחְיֶה",
    quoteEn: "Therefore choose life, that you and your offspring may live",
    sourceHe: "דְּבָרִים ל׳:י״ט",
    sourceEn: "Deuteronomy 30:19",
  },
  starOfDavid: {
    quoteHe: "מָגֵן הוּא לְכֹל הַחֹסִים בּוֹ",
    quoteEn: "He is a shield to all who take refuge in Him",
    sourceHe: "תְּהִלִּים י״ח:ל״א",
    sourceEn: "Psalms 18:31",
  },
  harp: {
    quoteHe: "הַלְלוּהוּ בְנֵבֶל וְכִנּוֹר",
    quoteEn: "Praise Him with harp and lyre",
    sourceHe: "תְּהִלִּים ק״נ:ג׳",
    sourceEn: "Psalms 150:3",
  },
  "third-temple": {
    quoteHe: "וְנָכוֹן  יִהְיֶה הַר בֵּית־יְהֹוָה בְּרֹאשׁ הֶהָרִים",
    quoteEn:
      "And the mountain of the LORD's house shall be established as the highest of the mountains",
    sourceHe: "יְשַׁעְיָהוּ ב׳:ב׳",
    sourceEn: "Isaiah 2:2",
  },
};

// --- Update Products.products.json ---
const products = JSON.parse(fs.readFileSync(productsPath, "utf8"));
let jsonProductUpdates = 0;

for (const product of products) {
  if (product.category === "שילת") {
    product.category = "סמלי בני ישראל";
    product.categoryEn = "Symbols of Israel";
    const quotes = SYMBOL_QUOTES[product.id];
    if (quotes) {
      Object.assign(product, quotes);
    }
    jsonProductUpdates += 1;
  }

  if (product.category === "כוכבים" && STAR_SORT_ORDER[product.id] != null) {
    product.sortOrder = STAR_SORT_ORDER[product.id];
    jsonProductUpdates += 1;
  }
}

fs.writeFileSync(productsPath, JSON.stringify(products, null, 2) + "\n");
console.log(`✅ Updated ${jsonProductUpdates} products in Products.products.json`);

async function syncMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("MONGODB_URI not set — skipped MongoDB sync.");
    return;
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  // 1. Rename שילת products + add quotes
  const shilatResult = await ProductMongo.updateMany(
    { category: "שילת" },
    {
      $set: {
        category: "סמלי בני ישראל",
        categoryEn: "Symbols of Israel",
        updatedAt: new Date(),
      },
    },
  );
  console.log(`✅ Renamed ${shilatResult.modifiedCount} שילת → סמלי בני ישראל products`);

  for (const [id, quotes] of Object.entries(SYMBOL_QUOTES)) {
    const result = await ProductMongo.updateOne(
      { id },
      { $set: { ...quotes, updatedAt: new Date() } },
    );
    if (result.modifiedCount > 0 || result.matchedCount > 0) {
      console.log(`  ✅ Quotes set for ${id}`);
    }
  }

  // Also update any products already under new category name missing quotes
  for (const [id, quotes] of Object.entries(SYMBOL_QUOTES)) {
    await ProductMongo.updateOne(
      { id, category: "סמלי בני ישראל" },
      { $set: { ...quotes, categoryEn: "Symbols of Israel", updatedAt: new Date() } },
    );
  }

  // 2. Stars sortOrder
  for (const [id, sortOrder] of Object.entries(STAR_SORT_ORDER)) {
    await ProductMongo.updateOne(
      { id },
      { $set: { sortOrder, updatedAt: new Date() } },
    );
  }
  console.log("✅ Set sortOrder on כוכבים products");

  // 3. Category: rename שילת slug → סמלי בני ישראל
  const oldCat = await CategoryMongo.findOne({ slug: "שילת" });
  if (oldCat) {
    const existing = await CategoryMongo.findOne({ slug: "סמלי בני ישראל" });
    if (existing) {
      await CategoryMongo.deleteOne({ slug: "שילת" });
      console.log("✅ Removed old שילת category (new slug already exists)");
    } else {
      await CategoryMongo.updateOne(
        { slug: "שילת" },
        {
          $set: {
            slug: "סמלי בני ישראל",
            nameHe: "סמלי בני ישראל",
            nameEn: "Symbols of Israel",
          },
        },
      );
      console.log("✅ Renamed category שילת → סמלי בני ישראל");
    }
  } else {
    await CategoryMongo.updateOne(
      { slug: "סמלי בני ישראל" },
      {
        $set: {
          nameHe: "סמלי בני ישראל",
          nameEn: "Symbols of Israel",
        },
      },
      { upsert: false },
    );
  }

  // 4. Trinity display name
  const trinityResult = await CategoryMongo.updateOne(
    { slug: "שלישיות מיוחדות" },
    {
      $set: {
        nameHe: "כוכב, מזל ואבן חושן",
        nameEn: "Trinity Pendants",
      },
    },
  );
  console.log(
    `✅ Updated שלישיות nameHe (${trinityResult.modifiedCount} modified)`,
  );

  await mongoose.disconnect();
  console.log("Done.");
}

syncMongo().catch((err) => {
  console.error(err);
  process.exit(1);
});
