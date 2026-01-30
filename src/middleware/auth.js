import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Protect routes - verify JWT token
export const protect = async (req, res, next) => {
  let token;

  // Check for token in header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "לא מורשה - נדרש אימות",
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token (Firebase doesn't need .select, it just doesn't return password)
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "משתמש לא נמצא",
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "לא מורשה - טוקן לא תקין",
    });
  }
};

// Admin middleware
export const admin = (req, res, next) => {
  if (req.user && (req.user.role === "admin" || req.user.role === "roi")) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: "גישה נדחתה - נדרשות הרשאות מנהל",
    });
  }
};

// Optional protect - allows both authenticated users and guests
export const optionalProtect = async (req, res, next) => {
  let token;

  // Check for token in header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  // If there's a token, try to verify it
  if (token && token !== "null" && token !== "undefined") {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id);

      if (!req.user) {
        console.log("⚠️ משתמש לא נמצא, ממשיך כאורח");
      } else {
        console.log(`✅ משתמש מאומת: ${req.user.email}`);
      }
    } catch (error) {
      // Invalid token, but we allow guests, so continue
      console.log("⚠️ טוקן לא תקין, ממשיך כאורח");
    }
  } else {
    console.log("ℹ️ אין טוקן - ממשיך כאורח");
  }

  // Continue regardless of authentication status
  next();
};

// Generate JWT Token
export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "30d",
  });
};
