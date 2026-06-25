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
// import smtpRoutes from "./routes/stmpRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import emailRoutes from "./routes/emailRoutes.js";
import couponRoutes from "./routes/couponRoutes.js";
import newsletterRoutes from "./routes/newsletterRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import Device from "./models/Device.js";
import { getClientIP } from "./utils/clientIp.js";

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
const normalizeOrigin = (url) => (url ? url.replace(/\/$/, "") : null);

const allowedOrigins = [
  normalizeOrigin(process.env.FRONTEND_URL),
  "https://shmimveeretz.netlify.app",
  "https://www.shmimveeretz.netlify.app",
  "https://shamaimveeretz.com",
  "https://www.shamaimveeretz.com",
  // Local development
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
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

// Rate limiting — successful GETs don't count; 429 always returns JSON
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 250,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "יותר מדי בקשות מכתובת IP זו, נסה שוב מאוחר יותר",
    });
  },
});

app.use("/api", limiter);

// IP block enforcement - runs on every API request
app.use("/api", async (req, res, next) => {
  // Skip for the track endpoint (called before login)
  if (req.path === "/admin/devices/track") return next();

  try {
    const clientIP = getClientIP(req);
    const isBlocked = await Device.isIPBlocked(clientIP);
    if (isBlocked) {
      console.log(`🚫 Blocked IP attempted access: ${clientIP} → ${req.path}`);
      return res.status(403).json({
        success: false,
        message: "כתובת IP זו נחסמה. אנא פנה לתמיכה",
      });
    }
  } catch (err) {
    // Don't block on DB errors — fail open
    console.error("IP block check error:", err.message);
  }
  next();
});

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
// app.use("/api/smtp", smtpRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/categories", categoryRoutes);

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

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`
❌ Port ${PORT} is already in use.

Another backend instance is probably still running.
Stop it first, then restart:

  Windows (PowerShell):
    Get-NetTCPConnection -LocalPort ${PORT} | Select-Object OwningProcess
    Stop-Process -Id <PID> -Force

  Or close the other terminal running "npm run dev" / "dev:all".
`);
    process.exit(1);
  }

  console.error("❌ Server error:", err.message);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.log(`❌ Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

export default app;
