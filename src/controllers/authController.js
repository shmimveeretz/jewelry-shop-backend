import User from "../models/User.js";
import Device from "../models/Device.js";
import { generateToken } from "../middleware/auth.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { getClientIP } from "../utils/clientIp.js";

import {
  sendWelcomeEmail,
  sendNewUserNotificationToAdmin,
  sendPasswordResetEmail,
} from "../utils/emailService.js";

const RESET_CODE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const STAFF_ROLES = ["admin", "roi"];

/**
 * Who may change another account. Only the superadmin ("roi") can grant or
 * revoke staff roles or act on another staff account, and nobody can demote,
 * block or delete themselves (which could lock the shop out of its own panel).
 * Returns an error message, or null when allowed.
 */
const checkUserManagement = (actor, target, nextRole) => {
  if (String(actor.id) === String(target.id)) {
    return "לא ניתן לבצע פעולה זו על החשבון שלך";
  }
  const touchesStaff =
    STAFF_ROLES.includes(target.role) || (nextRole && STAFF_ROLES.includes(nextRole));
  if (touchesStaff && actor.role !== "roi") {
    return "רק מנהל-על יכול לשנות חשבונות מנהלים";
  }
  return null;
};

// Helper function to extract device info from User-Agent
const getDeviceInfo = (userAgent) => {
  if (!userAgent) return "Unknown Device";

  let deviceName = "Unknown";
  if (userAgent.includes("Windows")) deviceName = "Windows PC";
  else if (userAgent.includes("Mac")) deviceName = "MacBook";
  else if (userAgent.includes("iPhone")) deviceName = "iPhone";
  else if (userAgent.includes("iPad")) deviceName = "iPad";
  else if (userAgent.includes("Android")) deviceName = "Android Phone";
  else if (userAgent.includes("Linux")) deviceName = "Linux PC";

  return deviceName;
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const firstName = req.body.firstName || req.body.firstname;
    const lastName = req.body.lastName || req.body.lastname;
    const { email, password, phone } = req.body;
    // The signup form sends `newsletterSubscribe`; older clients sent the model name.
    const isSubscribedToNewsletter =
      req.body.newsletterSubscribe ?? req.body.isSubscribedToNewsletter;

    // Validate required fields
    if (!firstName || !lastName || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: "כל השדות חובה",
      });
    }

    // Create user (will validate and check if exists internally)
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone,
      isSubscribedToNewsletter: isSubscribedToNewsletter !== false,
    });

    // Generate token
    const token = generateToken(user.id);

    // Send welcome email to user (don't wait for it)
    sendWelcomeEmail(email, { name: `${firstName} ${lastName}` }).catch(
      (error) => {
        console.error("Error sending welcome email:", error);
      },
    );

    // Send notification to admin (don't wait for it)
    sendNewUserNotificationToAdmin({
      name: `${firstName} ${lastName}`,
      email,
      phone,
    }).catch((error) => {
      console.error("Error sending admin notification:", error);
    });

    res.status(201).json({
      success: true,
      message: "משתמש נוצר בהצלחה",
      token,
      data: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    // Check if error is about password validation
    if (error.message.includes("הסיסמה")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "נא להזין אימייל וסיסמה",
      });
    }

    // Check for user (including password field)
    const user = await User.findByEmail(email, true);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "אימייל או סיסמה שגויים",
      });
    }

    // Check if user is blocked
    if (user.blocked) {
      console.log("🚫 Login attempt from blocked user:", email);
      return res.status(403).json({
        success: false,
        message: "חשבון זה נחסם. אנא פנה לתמיכה",
      });
    }

    // Check password
    const isMatch = await User.comparePassword(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "אימייל או סיסמה שגויים",
      });
    }

    // Accounts reset before hashing was fixed hold a plain password; upgrade it.
    if (!User.isHashed(user.password)) {
      await User.updatePassword(user.id, password, { skipFormatCheck: true });
    }

    // Get client IP and device info
    const clientIP = getClientIP(req);
    const userAgent = req.headers["user-agent"] || "Unknown";
    const deviceName = getDeviceInfo(userAgent);

    console.log("🔐 Login from device:");
    console.log("IP:", clientIP);
    console.log("Device:", deviceName);

    // Check if IP is blocked
    const isBlocked = await Device.isIPBlocked(clientIP);
    if (isBlocked) {
      console.log("🚫 Login attempt from blocked IP:", clientIP);
      return res.status(403).json({
        success: false,
        message: "כתובת IP זו נחסמה. אנא פנה לתמיכה",
      });
    }

    // Check if device exists or create new one
    let device = await Device.findByUserAndIP(user.id, clientIP);
    if (device) {
      // Update last login for existing device
      device = await Device.updateLastLogin(user.id, clientIP);
      console.log("📱 Device login updated:", device?.deviceName);
    } else {
      // Check if there's an anonymous tracking record for this IP and claim it
      const anonDevice = await Device.findAnonymousByIP(clientIP);
      if (anonDevice) {
        device = await Device.claimDevice(
          anonDevice,
          user.id,
          deviceName,
          userAgent,
        );
        console.log("🔗 Anonymous device linked to user:", deviceName);
      } else {
        // Create new device entry
        device = await Device.create({
          userId: user.id,
          ipAddress: clientIP,
          deviceName,
          userAgent,
        });
        console.log("✨ New device registered:", deviceName);
      }
    }

    // Generate token
    const token = generateToken(user.id);

    res.json({
      success: true,
      message: "התחברת בהצלחה",
      token,
      data: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        deviceInfo: device
          ? {
              deviceName: device.deviceName,
              ipAddress: device.ipAddress,
              loginCount: device.loginCount,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "משתמש לא נמצא",
      });
    }

    const { verificationCode, verificationCodeExpire, verificationAttempts, ...safeUser } = user;
    res.json({
      success: true,
      data: safeUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const fieldsToUpdate = {};

    if (req.body.name) fieldsToUpdate.name = req.body.name;
    if (req.body.email) fieldsToUpdate.email = req.body.email;
    if (req.body.phone) fieldsToUpdate.phone = req.body.phone;
    if (req.body.address) fieldsToUpdate.address = req.body.address;

    const user = await User.update(req.user.id, fieldsToUpdate);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update password
// @route   PUT /api/auth/password
// @access  Private
export const updatePassword = async (req, res) => {
  try {
    if (!req.body.currentPassword || !req.body.newPassword) {
      return res.status(400).json({
        success: false,
        message: "נא להזין סיסמה נוכחית וסיסמה חדשה",
      });
    }

    const user = await User.findById(req.user.id, true);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "משתמש לא נמצא",
      });
    }

    // Check current password
    const isMatch = await User.comparePassword(
      req.body.currentPassword,
      user.password,
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "סיסמה נוכחית שגויה",
      });
    }

    await User.updatePassword(req.user.id, req.body.newPassword);

    const token = generateToken(user.id);

    res.json({
      success: true,
      message: "הסיסמה עודכנה בהצלחה",
      token,
    });
  } catch (error) {
    res.status(error.message?.includes("הסיסמה") ? 400 : 500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Forgot password - email a one-time reset code
// @route   POST /api/auth/forgotpassword
// @access  Public
export const forgotPassword = async (req, res) => {
  // Same answer whether or not the address is registered, so the endpoint
  // cannot be used to discover which emails have accounts.
  const genericResponse = {
    success: true,
    message: "אם הכתובת רשומה במערכת, נשלח אליה קוד אימות",
  };

  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim() : "";
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "נא להזין כתובת אימייל" });

    const user = await User.findByEmail(email);
    if (!user || user.blocked) return res.json(genericResponse);

    const verificationCode = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const verificationCodeExpire = new Date(Date.now() + RESET_CODE_TTL_MS);

    await User.update(user.id, {
      verificationCode,
      verificationCodeExpire,
      verificationAttempts: 0,
    });

    const emailResult = await sendPasswordResetEmail(user.email, {
      name: `${user.firstName} ${user.lastName}`,
      verificationCode,
    });

    if (!emailResult.success) {
      console.error("❌ Reset email error:", emailResult.message);
      await User.update(user.id, {
        verificationCode: null,
        verificationCodeExpire: null,
      });
      return res
        .status(500)
        .json({ success: false, message: "שגיאה בשליחת האימייל" });
    }

    res.json(genericResponse);
  } catch (error) {
    console.error("❌ Forgot Password Error:", error.message);
    res.status(500).json({ success: false, message: "שגיאת שרת" });
  }
};

const INVALID_CODE = { success: false, message: "קוד לא תקף או פג תוקף" };

/** Constant-time string comparison for reset codes. */
const codesMatch = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

// @desc    Verify the emailed reset code
// @route   POST /api/auth/verifycode
// @access  Public
//
// Returns a short-lived token that is only good for changePassword. It is not
// a login token: `protect` rejects anything carrying a `purpose` claim.
export const verifyCode = async (req, res) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim() : "";
    const code = typeof req.body.code === "string" ? req.body.code.trim() : String(req.body.code ?? "");

    if (!email || !code)
      return res
        .status(400)
        .json({ success: false, message: "נא להזין אימייל וקוד אימות" });

    const user = await User.findByEmail(email);
    if (!user?.verificationCode) return res.status(400).json(INVALID_CODE);

    const expired =
      !user.verificationCodeExpire ||
      new Date(user.verificationCodeExpire).getTime() < Date.now();
    const attempts = Number(user.verificationAttempts) || 0;

    if (expired || attempts >= MAX_CODE_ATTEMPTS) {
      await User.update(user.id, { verificationCode: null, verificationCodeExpire: null });
      return res.status(400).json(INVALID_CODE);
    }

    if (!codesMatch(user.verificationCode, code)) {
      await User.update(user.id, { verificationAttempts: attempts + 1 });
      return res.status(400).json(INVALID_CODE);
    }

    const resetToken = jwt.sign(
      { id: user.id, purpose: "password-reset", code: user.verificationCode },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );

    res.json({
      success: true,
      message: "קוד אומת בהצלחה",
      resetToken,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  } catch (error) {
    console.error("❌ Verify Code Error:", error.message);
    res.status(500).json({ success: false, message: "שגיאת שרת" });
  }
};

// @desc    Set a new password using the token from verifyCode
// @route   POST /api/auth/changepassword
// @access  Public (requires a valid reset token)
export const changePassword = async (req, res) => {
  try {
    const { newPassword, resetToken } = req.body;

    if (!newPassword || !resetToken) {
      return res.status(400).json({
        success: false,
        message: "סיסמה חדשה וקוד איפוס נדרשים",
      });
    }

    let payload;
    try {
      payload = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ success: false, message: "קישור האיפוס פג תוקף. נסה שוב" });
    }

    if (payload?.purpose !== "password-reset" || !payload.id) {
      return res.status(400).json({ success: false, message: "קוד איפוס לא תקין" });
    }

    const user = await User.findById(payload.id);
    // The code is cleared after use, so each reset token works exactly once.
    if (!user || !user.verificationCode || !codesMatch(user.verificationCode, payload.code)) {
      return res.status(400).json({ success: false, message: "קישור האיפוס כבר נוצל או פג תוקף" });
    }

    await User.updatePassword(user.id, newPassword);
    await User.update(user.id, {
      verificationCode: null,
      verificationCodeExpire: null,
      verificationAttempts: 0,
    });

    const token = generateToken(user.id);

    res.json({
      success: true,
      message: "הסיסמה שונתה בהצלחה",
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (error) {
    if (error.message?.includes("הסיסמה")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("❌ Change Password Error:", error.message);
    res.status(500).json({ success: false, message: "שגיאת שרת" });
  }
};

// @desc    Get all users (admin only)
// @route   GET /api/users
// @access  Private/Admin
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll();

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update user role (admin only)
// @route   PUT /api/users/:id/role
// @access  Private/Admin
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    console.log("🔄 Update User Role Request:");
    console.log("📝 ID:", id);
    console.log("👤 Role:", role);

    // Validate role
    if (!role || !["user", "admin", "customer", "roi"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "תפקיד לא תקף. תפקידים זמינים: user, admin, customer, roi",
      });
    }

    // Check if ID is valid MongoDB ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "ID משתמש לא תקף",
      });
    }

    const user = await User.findById(id);
    console.log("🔍 User found:", user ? "YES" : "NO");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "משתמש לא נמצא",
      });
    }

    const denied = checkUserManagement(req.user, user, role);
    if (denied) {
      return res.status(403).json({ success: false, message: denied });
    }

    const updatedUser = await User.update(id, { role });
    console.log("✅ User role updated:", updatedUser.role);

    res.json({
      success: true,
      message: "תפקיד המשתמש עודכן בהצלחה",
      data: updatedUser,
    });
  } catch (error) {
    console.error("❌ Error updating user role:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete user (admin only)
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("🗑️ Delete User Request:");
    console.log("📝 ID:", id);

    // Check if ID is valid MongoDB ObjectId format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "ID משתמש לא תקף",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "משתמש לא נמצא",
      });
    }

    const denied = checkUserManagement(req.user, user);
    if (denied) {
      return res.status(403).json({ success: false, message: denied });
    }

    await User.delete(id);
    console.log("✅ User deleted successfully");

    res.json({
      success: true,
      message: "משתמש נמחק בהצלחה",
    });
  } catch (error) {
    console.error("❌ Error deleting user:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Block/Unblock user
// @route   PUT /api/users/:id/block
// @access  Private/Admin
export const blockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { blocked } = req.body;

    console.log("🔒 Block User Request:");
    console.log("📝 User ID:", id);
    console.log("🚫 Blocked:", blocked);

    if (typeof blocked !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "blocked field must be a boolean",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "משתמש לא נמצא",
      });
    }

    const denied = checkUserManagement(req.user, user);
    if (denied) {
      return res.status(403).json({ success: false, message: denied });
    }

    const updatedUser = await User.update(id, { blocked });
    console.log("✅ User blocked status updated:", blocked);

    res.json({
      success: true,
      message: blocked ? "משתמש חסום בהצלחה" : "חסימת משתמש בוטלה בהצלחה",
      data: updatedUser,
    });
  } catch (error) {
    console.error("❌ Error blocking user:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
