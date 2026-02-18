import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import connectDB from "./config/database.js";

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

const app = express();

// Trust proxy - needed for rate limiting behind a reverse proxy (Render, etc.)
app.set("trust proxy", 1);

// Security middleware
app.use(helmet());

// --- תיקון 1: עדכון רשימת הדומיינים המורשים ---
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
  "https://shmimveeretz.netlify.app",
  "https://www.shmimveeretz.netlify.app",
  "https://shmimveeretz.com",
  "https://www.shmimveeretz.com",
  "https://shmaimveeretz.com",
  "https://www.shmaimveeretz.com",
  "https://shamaimveeretz.com", // Another typo variant
  "https://www.shamaimveeretz.com", // Another typo variant
].filter(Boolean);

console.log("📝 CORS Allowed Origins:", allowedOrigins);

// --- תיקון 2: העברת CORS לפני Rate Limiter ---
// זה מונע מצב שהשרת חוסם בקשות בדיקה (OPTIONS) בגלל עומס
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log("❌ CORS Blocked Origin:", origin); // הוספתי לוג ברור יותר
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // הגדרת מתודות מורשות
    allowedHeaders: ["Content-Type", "Authorization"], // הגדרת כותרות מורשות
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "יותר מדי בקשות מכתובת IP זו, נסה שוב מאוחר יותר",
});

app.use("/api", limiter);

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
║          🌟 שמיים וארץ - Shamayim VaAretz 🌟            ║
║                                                           ║
║   Server running in ${process.env.NODE_ENV || "development"} mode                  ║
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
