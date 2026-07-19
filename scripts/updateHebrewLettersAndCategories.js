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

const SINGLE_LETTER_LENGTHS = ["39", "40", "41", "42", "43", "44", "45"];
const LETTER_CHAIN_NECKLACE_LENGTHS = ["39", "40", "42", "45", "47", "50"];
const LETTER_CHAIN_BRACELET_LENGTHS = [
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
];

const zeroMap = (sizes) => Object.fromEntries(sizes.map((s) => [s, 0]));

const LETTER_CHAIN_PRODUCT = {
  _id: { $oid: "69d8b56711eb709fd6847299" },
  id: "letter-chain",
  name: "שרשרת אותיות",
  nameEn: "Letter Chain",
  category: "אותיות עבריות",
  categoryEn: "Hebrew Letters",
  price: 390,
  sortOrder: 0,
  featured: true,
  priceAdditions: {
    metalType: {
      "כסף 925": 0,
      "ציפוי זהב": 30,
      "זהב 14 קראט": 2040,
    },
    length: {
      שרשרת: zeroMap(LETTER_CHAIN_NECKLACE_LENGTHS),
      צמיד: zeroMap(LETTER_CHAIN_BRACELET_LENGTHS),
    },
    jewelryType: {
      שרשרת: 0,
      צמיד: 0,
    },
    extraLetterForBracelet: {
      "כסף 925": 90,
      "ציפוי זהב": 110,
      "זהב 14 קראט": 240,
    },
  },
  images: [
    "https://res.cloudinary.com/dhayarvh3/image/upload/f_auto,q_auto/Letter_Aleph_Silver_Main.jpg",
    "https://res.cloudinary.com/dhayarvh3/image/upload/v1782262537/Letter_Bracelet_Gold.jpg",
    "https://res.cloudinary.com/dhayarvh3/image/upload/v1782262757/Letters_Bracelet_Silver_2.jpg",
  ],
  description:
    "שרשרת או צמיד אותיות מותאם אישית — בחרו סוג תכשיט, אורך ואותיות נוספות. הצמיד מגיע בשני סיבובים על היד.",
  descriptionEn:
    "Custom letter necklace or bracelet — choose jewelry type, length, and additional letters. The bracelet wraps twice around the wrist.",
  types: ["שרשרת", "צמיד"],
};

const CATEGORY_UPDATES = [
  {
    slug: "כוכבים",
    descriptionHe:
      "וַיַּעַשׂ אֱלֹהִים אֵת שְׁנֵי הַמְּאֹרֹת הַגְּדֹלִים אֶת־הַמָּאוֹר הַגָּדֹל לְמֶמְשֶׁלֶת הַיּוֹם וְאֵת הַמָּאוֹר הַקָּטֹן לְמֶמְשֶׁלֶת הַלַּיְלָה וְאֵת הַכּוֹכָבִים",
    descriptionEn:
      "And God made the two great lights—the greater light to govern the day and the lesser light to govern the night—and the stars",
    sourceHe: "בְּרֵאשִׁית א׳:ט״ז",
    sourceEn: "Genesis 1:16",
  },
  {
    slug: "תליוני מזלות",
    descriptionHe:
      "בִּדְבַר יְהֹוָה שָׁמַיִם נֶעֱשׂוּ וּבְרוּחַ פִּיו כָּל־צְבָאָם",
    descriptionEn:
      "By the word of the LORD the heavens were made, and by the breath of His mouth all their host",
    sourceHe: "תְּהִלִּים ל״ג:ו׳",
    sourceEn: "Psalms 33:6",
  },
  {
    slug: "אבני חושן",
    descriptionHe:
      "וְהָאֲבָנִים תִּהְיֶיןָ עַל־שְׁמֹת בְּנֵי־יִשְׂרָאֵל שְׁתֵּים עֶשְׂרֵה עַל־שְׁמוֹתָם פִּתּוּחֵי חוֹתָם אִישׁ עַל־שְׁמוֹ תִּהְיֶיןָ לִשְׁנֵי עָשָׂר שָׁבֶט",
    descriptionEn:
      "And the stones shall be on the names of the sons of Israel, twelve according to their names, like the engravings of a signet, every one according to his name shall they be for the twelve tribes",
    sourceHe: "שְׁמוֹת כ״ח:כ״א",
    sourceEn: "Exodus 28:21",
  },
  {
    slug: "סמלי בני ישראל",
    descriptionHe: "שְׂאוּ מָרוֹם עֵינֵיכֶם וּרְאוּ מִי־בָרָא אֵלֶּה",
    descriptionEn: "Lift up your eyes on high and see: who created these?",
    sourceHe: "יְשַׁעְיָהוּ מ׳:כ״ו",
    sourceEn: "Isaiah 40:26",
  },
  {
    slug: "שלישיות מיוחדות",
    nameHe: "כוכב, מזל ואבן חושן",
    descriptionHe:
      "שֶׁמַּזָּל, כּוֹכָב וְאֶבֶן חוֹשֶׁן נִפְגָּשִׁים = הַנְּשָׁמָה נִזְכֶּרֶת",
    descriptionEn:
      "When zodiac, star and hoshen stone meet — the soul is remembered",
    sourceHe: "",
    sourceEn: "",
  },
];

const products = JSON.parse(fs.readFileSync(productsPath, "utf8"));

let lettersUpdated = 0;
const normalized = products.filter((p) => p.id !== "letter-chain");

for (const product of normalized) {
  if (product.category !== "אותיות עבריות") continue;

  product.priceAdditions = product.priceAdditions || {};
  product.priceAdditions.length = zeroMap(SINGLE_LETTER_LENGTHS);
  delete product.priceAdditions.jewelryType;
  delete product.priceAdditions.extraLetterForBracelet;
  product.types = ["שרשרת"];
  lettersUpdated += 1;
}

const firstLetterIdx = normalized.findIndex(
  (p) => p.category === "אותיות עבריות",
);
if (firstLetterIdx === -1) {
  normalized.unshift(LETTER_CHAIN_PRODUCT);
} else {
  normalized.splice(firstLetterIdx, 0, LETTER_CHAIN_PRODUCT);
}

fs.writeFileSync(productsPath, JSON.stringify(normalized, null, 2) + "\n");
console.log(
  `Updated ${lettersUpdated} single-letter products; inserted letter-chain at index ${firstLetterIdx === -1 ? 0 : firstLetterIdx}`,
);

async function syncMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("MONGODB_URI not set — skipped MongoDB sync.");
    return;
  }

  await mongoose.connect(uri);

  for (const product of normalized) {
    if (product.category !== "אותיות עבריות") continue;
    const { _id, ...rest } = product;
    await ProductMongo.updateOne(
      { id: product.id },
      { $set: rest },
      { upsert: true },
    );
  }
  console.log("Synced Hebrew letter products to MongoDB.");

  for (const cat of CATEGORY_UPDATES) {
    await CategoryMongo.updateOne({ slug: cat.slug }, { $set: cat });
  }
  console.log(`Updated ${CATEGORY_UPDATES.length} categories in MongoDB.`);

  await mongoose.disconnect();
}

syncMongo().catch((err) => {
  console.error("MongoDB sync failed:", err.message);
  process.exitCode = 1;
});
