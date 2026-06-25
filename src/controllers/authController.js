import User from "../models/User.js";
import Device from "../models/Device.js";
import { generateToken } from "../middleware/auth.js";
import speakeasy from "speakeasy";
import { getClientIP } from "../utils/clientIp.js";
import {
  sendWelcomeEmail,
  sendNewUserNotificationToAdmin,
  sendPasswordResetEmail,
} from "../utils/emailService.js";

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
    const { email, password, phone, isSubscribedToNewsletter } = req.body;

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
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Forgot password - send reset code with Magic Link + TOTP
// @route   POST /api/auth/forgotpassword
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "נא להזין כתובת אימייל" });

    const user = await User.findByEmail(email);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "לא נמצא משתמש עם כתובת אימייל זו" });

    const secret = speakeasy.generateSecret({ length: 32 });
    const verificationCode = speakeasy.totp({
      secret: secret.base32,
      encoding: "base32",
      time: 300,
    });
    const verificationCodeExpire = new Date(Date.now() + 10 * 60 * 1000);

    await User.update(user.id, { verificationCode, verificationCodeExpire });

    try {
      const emailResult = await sendPasswordResetEmail(email, {
        name: `${user.firstName} ${user.lastName}`,
        verificationCode,
      });
      if (!emailResult.success) throw new Error(emailResult.message);

      res.json({ success: true, message: "נשלח קוד אימות לאימייל" });
    } catch (error) {
      console.error("❌ Reset email error:", error.message);
      await User.update(user.id, {
        verificationCode: null,
        verificationCodeExpire: null,
      });
      return res
        .status(500)
        .json({ success: false, message: "שגיאה בשליחת האימייל" });
    }
  } catch (error) {
    console.error("❌ Forgot Password Error:", error.message);
    console.error("Full error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Verify TOTP code
// @route   POST /api/auth/verifycode
// @access  Public
export const verifyCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code)
      return res
        .status(400)
        .json({ success: false, message: "נא להזין אימייל וקוד אימות" });

    const user = await User.findByEmail(email);
    if (!user)
      return res.status(404).json({ success: false, message: "משתמש לא נמצא" });

    if (
      user.verificationCode !== code ||
      user.verificationCodeExpire < Date.now()
    ) {
      return res
        .status(400)
        .json({ success: false, message: "קוד לא תקף או פג תוקף" });
    }

    const resetToken = generateToken(user.id);
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reset password
// @route   PUT /api/auth/resetpassword/:code
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const { code } = req.params;

    if (!password)
      return res
        .status(400)
        .json({ success: false, message: "נא להזין סיסמה חדשה" });
    if (!code)
      return res.status(400).json({ success: false, message: "קוד אימות חסר" });

    const users = await User.findAll();
    const user = users.find(
      (u) =>
        u.verificationCode === code && u.verificationCodeExpire > Date.now(),
    );

    if (!user)
      return res
        .status(400)
        .json({ success: false, message: "קוד לא תקף או פג תוקף" });

    await User.updatePassword(user.id, password);
    await User.update(user.id, {
      verificationCode: null,
      verificationCodeExpire: null,
    });

    const token = generateToken(user.id);
    res.json({ success: true, message: "הסיסמה שונתה בהצלחה", token });
  } catch (error) {
    console.error("❌ Reset Password Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Change password after verification
// @route   POST /api/auth/changepassword
// @access  Public
export const changePassword = async (req, res) => {
  try {
    const { email, newPassword, resetToken } = req.body;

    console.log("🔐 Change Password Request");
    console.log("📧 Email:", email);

    if (!email || !newPassword || !resetToken) {
      return res.status(400).json({
        success: false,
        message: "אימייל, סיסמה חדשה וtoken נדרשים",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "הסיסמה חייבת להיות לפחות 6 תווים",
      });
    }

    // Find user
    const user = await User.findByEmail(email);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "משתמש לא נמצא",
      });
    }

    // Verify that verification code is still valid (and resetToken would be checked on frontend)
    console.log("⏰ Checking code expiration...");
    if (
      !user.verificationCodeExpire ||
      user.verificationCodeExpire < Date.now()
    ) {
      return res.status(400).json({
        success: false,
        message: "הקוד פג תוקף",
      });
    }

    console.log("🔐 Updating password...");
    // Update password
    await User.updatePassword(user.id, newPassword);

    // Clear verification code
    await User.update(user.id, {
      verificationCode: undefined,
      verificationCodeExpire: undefined,
    });

    console.log("✅ Password changed successfully");

    // Generate new JWT token
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
      },
    });
  } catch (error) {
    console.error("❌ Change Password Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
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
