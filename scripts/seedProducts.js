import dotenv from "dotenv";
import mongoose from "mongoose";
import ProductMongo from "../src/models/ProductMongo.js";

dotenv.config();

const sampleProducts = [
  {
    name: "תליון מגן דוד זהב",
    description: "תליון מגן דוד עשוי זהב 14 קראט, עם עיצוב קלאסי מעוטר",
    category: "מגן דוד",
    price: 350,
    discountPrice: null,
    images: [
      "https://res.cloudinary.com/dvn4b6ktd/image/upload/v1/products/david-star-gold"
    ],
    metals: ["זהב"],
    stock: 5,
    zodiacSign: "כללי",
    featured: true,
    rating: 4.5,
    reviews: []
  },
  {
    name: "תליון חי כסף",
    description: "סמל החיים המצרי העתיק - תליון חי בכסף טהור",
    category: "חי",
    price: 280,
    discountPrice: 240,
    images: [
      "https://res.cloudinary.com/dvn4b6ktd/image/upload/v1/products/ankh-silver"
    ],
    metals: ["כסף"],
    stock: 8,
    zodiacSign: "כללי",
    featured: true,
    rating: 4.8,
    reviews: []
  },
  {
    name: "חמסה מגן זהב לבן",
    description: "חמסה עתיקה לשם הגנה, עשויה זהב לבן 18 קראט",
    category: "חמסה",
    price: 420,
    discountPrice: null,
    images: [
      "https://res.cloudinary.com/dvn4b6ktd/image/upload/v1/products/hamsa-white-gold"
    ],
    metals: ["זהב לבן"],
    stock: 3,
    zodiacSign: "כללי",
    featured: false,
    rating: 5,
    reviews: []
  },
  {
    name: "מזוזה כסף קטנה",
    description: "מזוזה קטנה לתליה, עשויה כסף סטרלינג 925",
    category: "מזוזה",
    price: 150,
    discountPrice: 120,
    images: [
      "https://res.cloudinary.com/dvn4b6ktd/image/upload/v1/products/mezuza-silver"
    ],
    metals: ["כסף"],
    stock: 12,
    zodiacSign: "כללי",
    featured: false,
    rating: 4.2,
    reviews: []
  },
  {
    name: "אות עברית - שיִן",
    description: "תליון אות עברית שיִן בתכנון מודרני, זהב צהוב",
    category: "אותיות",
    price: 200,
    discountPrice: null,
    images: [
      "https://res.cloudinary.com/dvn4b6ktd/image/upload/v1/products/hebrew-letter-shin"
    ],
    metals: ["זהב צהוב"],
    stock: 6,
    zodiacSign: "כללי",
    featured: false,
    rating: 4.7,
    reviews: []
  },
  {
    name: "תליון גדי - מזל",
    description: "תליון מזל גדי, עשוי זהב וכסף משולב",
    category: "אחר",
    price: 320,
    discountPrice: 280,
    images: [
      "https://res.cloudinary.com/dvn4b6ktd/image/upload/v1/products/zodiac-capricorn"
    ],
    metals: ["זהב", "כסף"],
    stock: 4,
    zodiacSign: "גדי",
    featured: true,
    rating: 4.6,
    reviews: []
  }
];

async function seedDatabase() {
  try {
    const mongoUrl = process.env.MONGODB_URI;
    console.log("🔗 Connecting to MongoDB...");
    
    await mongoose.connect(mongoUrl);
    console.log("✅ MongoDB Connected");

    // Clear existing products
    await ProductMongo.deleteMany({});
    console.log("🗑️ Cleared existing products");

    // Insert sample products
    const result = await ProductMongo.insertMany(sampleProducts);
    console.log(`✅ Seeded ${result.length} products successfully!`);

    result.forEach((product, index) => {
      console.log(`  ${index + 1}. ${product.name} (₪${product.price})`);
    });

    await mongoose.disconnect();
    console.log("🔌 MongoDB Disconnected");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

seedDatabase();
