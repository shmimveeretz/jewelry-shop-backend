import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import fs from "fs";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import connectDB from "./config/database.js";
import { initializeFirebase } from "./config/firebase.js";
import Product from "./models/Product.js";

// Import routes
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import smtpRoutes from "./routes/stmpRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

// Load env vars
dotenv.config();

// Connect to MongoDB
connectDB();

// Initialize Firebase
initializeFirebase();

// Auto-import products from jewelry.json on startup
const autoImportProducts = async () => {
  try {
    console.log("🔍 Checking if products need to be imported...");
    
    // Check if products already exist
    const productCount = await Product.Model.countDocuments();
    
    if (productCount > 0) {
      console.log(`✅ Products already imported (${productCount} products found)`);
      return;
    }
    
    console.log("📥 No products found, importing from jewelry.json...");
    
    const jewelryPath = "./data/jewelry.json";
    if (!fs.existsSync(jewelryPath)) {
      console.warn("⚠️  jewelry.json not found, skipping auto-import");
      return;
    }
    
    const jewelryData = JSON.parse(fs.readFileSync(jewelryPath, "utf8"));
    let imported = 0;
    
    for (const item of jewelryData) {
      try {
        const images = (item.images || []).map((url) => ({
          url,
          alt: item.name,
        }));
        
        await Product.create({
          name: item.name,
          nameEn: item.nameEn,
          description: item.description,
          descriptionEn: item.descriptionEn,
          category: item.category,
          price: item.price,
          images,
          metals: item.metals || [],
          letter: item.letter,
          meaningHe: item.meaningHe,
          meaningEn: item.meaningEn,
          gematria: item.gematria,
          types: item.types || [],
          stock: 10,
          zodiacSign: item.zodiacSign || "כללי",
          featured: false,
          rating: { average: 0, count: 0 },
          reviews: [],
        });
        imported++;
      } catch (error) {
        console.error(`⚠️  Failed to import ${item.name}: ${error.message}`);
      }
    }
    
    console.log(`✅ Auto-import complete! Imported ${imported} products`);
  } catch (error) {
    console.error("⚠️  Auto-import error:", error.message);
  }
};

// Run auto-import after short delay to ensure DB is ready
setTimeout(autoImportProducts, 2000);

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "יותר מדי בקשות מכתובת IP זו, נסה שוב מאוחר יותר",
});

app.use("/api", limiter);

// CORS - Support multiple origins
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
  "https://shmimveeretz.netlify.app",
  "https://www.shmimveeretz.netlify.app",
].filter(Boolean); // Remove undefined values

console.log("📝 CORS Allowed Origins:", allowedOrigins);

app.use(
  cors({
    origin: function (origin, callback) {
      console.log("🔍 Request origin:", origin);

      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        console.log("✅ No origin (mobile/curl)");
        return callback(null, true);
      }

      if (allowedOrigins.indexOf(origin) !== -1) {
        console.log("✅ Origin allowed:", origin);
        callback(null, true);
      } else {
        console.log("❌ Origin NOT allowed:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (logo, images, etc.)
app.use("/public", express.static("public"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/products", productRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/smtp", smtpRoutes);
app.use("/api/admin", adminRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Shamayim VaAretz API is running",
    timestamp: new Date().toISOString(),
  });
});

// Welcome route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to Shamayim VaAretz API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      products: "/api/products",
      payment: "/api/payment",
    },
  });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║           🌟 שמיים וארץ - Shamayim VaAretz 🌟            ║
║                                                           ║
║   Server running in ${
    process.env.NODE_ENV || "development"
  } mode                  ║
║   Port: ${PORT}                                           ║
║   URL: http://localhost:${PORT}                           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.log(`❌ Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

export default app;
