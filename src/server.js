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
import campaignRoutes from "./routes/campaignRoutes.js";
import dppRoutes from "./routes/dppRoutes.js";
import popupRoutes from "./routes/popupRoutes.js";
import adminProductPageRoutes from "./routes/adminProductPageRoutes.js";
import adminPopupRoutes from "./routes/adminPopupRoutes.js";
import adminLayoutRoutes from "./routes/adminLayoutRoutes.js";
import Device from "./models/Device.js";

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
  "https://shmimveeretz.netlify.app",
  "https://www.shmimveeretz.netlify.app",
  "https://shamaimveeretz.com", // Another typo variant
  "https://www.shamaimveeretz.com", // Another typo variant
  // Local Vite dev server (NODE_ENV=development in Backend/.env)
  ...(process.env.NODE_ENV !== "production"
    ? ["http://localhost:5173", "http://127.0.0.1:5173"]
    : []),
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
    // PATCH is used for partial saves: draft blocks, popup status, dashboard
    // layout and the newsletter subscriber toggle. Omitting it here fails the
    // preflight, so those requests never reach the routes at all.
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"], // הגדרת כותרות מורשות
  }),
);

// Campaign traffic reaches these endpoints through the Netlify edge function,
// so thousands of ad clicks arrive from a handful of edge node IPs. Under the
// general limiter below a successful campaign would throttle itself within
// seconds, so the public DPP surface gets its own, far more generous budget.
const CAMPAIGN_PATH_PREFIXES = ["/dpp", "/popups", "/campaign"];

const campaignLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3000,
  message: "יותר מדי בקשות, נסה שוב מאוחר יותר",
});

app.use("/api/dpp", campaignLimiter);
app.use("/api/popups", campaignLimiter);
app.use("/api/campaign", campaignLimiter);

// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "יותר מדי בקשות מכתובת IP זו, נסה שוב מאוחר יותר",
  // req.path is relative to the "/api" mount point.
  skip: (req) =>
    CAMPAIGN_PATH_PREFIXES.some((prefix) => req.path.startsWith(prefix)),
});

app.use("/api", limiter);

// IP block enforcement - runs on every API request
app.use("/api", async (req, res, next) => {
  // Skip for the track endpoint (called before login)
  if (req.path === "/admin/devices/track") return next();

  try {
    const clientIP =
      req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
      req.ip ||
      req.connection.remoteAddress;

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

// Normalize double-slash paths (PayPlus webhook URL had //api/... when BACKEND_URL ended with /)
app.use((req, res, next) => {
  if (req.url.includes("//")) {
    req.url = req.url.replace(/\/{2,}/g, "/");
  }
  next();
});

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
app.use("/api/campaign", campaignRoutes);

// Dedicated Product Pages: public read path + popup runtime
app.use("/api/dpp", dppRoutes);
app.use("/api/popups", popupRoutes);

// Marketing CMS (all mounted under /api/admin alongside adminRoutes)
app.use("/api/admin", adminProductPageRoutes);
app.use("/api/admin", adminPopupRoutes);
app.use("/api/admin", adminLayoutRoutes);

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
      categories: "/api/categories",
      orders: "/api/orders",
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
║          🌟 שמים וארץ - Shamayim VaAretz 🌟            ║
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
