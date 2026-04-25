import express from "express";
import { protect } from "../middleware/auth.js";
import Device from "../models/Device.js";

const router = express.Router();

// Helper function to check if user is admin or ROI
const checkAdminOrROI = (req, res, next) => {
  if (req.user.role !== "admin" && req.user.role !== "roi") {
    return res.status(403).json({
      success: false,
      message: "גישה ممnוע. דרוש אישור מנהל או ROI",
    });
  }
  next();
};

// @desc    Track a visitor device (no auth required - called before login)
// @route   POST /api/admin/devices/track
// @access  Public
router.post("/devices/track", async (req, res) => {
  try {
    const { ipAddress, location, deviceName, browser, os, screen, language } =
      req.body;

    if (!ipAddress) {
      return res.status(400).json({
        success: false,
        message: "ipAddress נדרש",
      });
    }

    const device = await Device.track({
      ipAddress,
      location,
      deviceName,
      browser,
      os,
      screen,
      language,
    });

    res.json({ success: true, data: device });
  } catch (error) {
    console.error("❌ Error tracking device:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get all devices with filtering
// @route   GET /api/admin/devices
// @access  Private/Admin/ROI
router.get("/devices", protect, checkAdminOrROI, async (req, res) => {
  try {
    const { userId, ipAddress, blocked, page = 1, limit = 50 } = req.query;

    console.log("📱 Get All Devices Request:");
    console.log("Filters:", { userId, ipAddress, blocked });

    const filter = {};
    if (userId) filter.userId = userId;
    if (ipAddress) filter.ipAddress = ipAddress;
    if (blocked !== undefined) filter.blocked = blocked === "true";

    const devices = await Device.findAll(filter);
    const paginatedDevices = devices.slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      data: paginatedDevices,
      total: devices.length,
      page,
      limit,
    });
  } catch (error) {
    console.error("❌ Error getting devices:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Get devices for specific user
// @route   GET /api/admin/devices/user/:userId
// @access  Private/Admin/ROI
router.get(
  "/devices/user/:userId",
  protect,
  checkAdminOrROI,
  async (req, res) => {
    try {
      const { userId } = req.params;

      console.log("📱 Get User Devices Request for:", userId);

      const devices = await Device.findAll({ userId });

      if (!devices || devices.length === 0) {
        return res.status(404).json({
          success: false,
          message: "לא נמצאו התקנים עבור משתמש זה",
        });
      }

      res.json({
        success: true,
        data: devices,
        total: devices.length,
      });
    } catch (error) {
      console.error("❌ Error getting user devices:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },
);

// @desc    Block device/IP
// @route   PUT /api/admin/devices/:id/block
// @access  Private/Admin/ROI
router.put("/devices/:id/block", protect, checkAdminOrROI, async (req, res) => {
  try {
    const { id } = req.params;
    const { blocked } = req.body;

    console.log("🚫 Block Device Request:");
    console.log("Device ID:", id);
    console.log("Blocked:", blocked);

    if (typeof blocked !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "blocked חייב להיות true או false",
      });
    }

    const device = await Device.blockIP(id, blocked);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "התקן לא נמצא",
      });
    }

    console.log(blocked ? "🔒 Device blocked" : "🔓 Device unblocked");

    res.json({
      success: true,
      message: blocked ? "התקן נחסם בהצלחה" : "התקן הופעל בהצלחה",
      data: device,
    });
  } catch (error) {
    console.error("❌ Error blocking device:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @desc    Block all devices for an IP address
// @route   PUT /api/admin/devices/ip/:ipAddress/block
// @access  Private/Admin/ROI
router.put(
  "/devices/ip/:ipAddress/block",
  protect,
  checkAdminOrROI,
  async (req, res) => {
    try {
      const { ipAddress } = req.params;
      const { blocked } = req.body;

      console.log("🚫 Block IP Address Request:");
      console.log("IP Address:", ipAddress);
      console.log("Blocked:", blocked);

      if (typeof blocked !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "blocked חייב להיות true או false",
        });
      }

      // Find all devices with this IP and block them
      const devices = await Device.findAll({ ipAddress });
      if (!devices || devices.length === 0) {
        return res.status(404).json({
          success: false,
          message: "לא נמצאו התקנים עבור כתובת IP זו",
        });
      }

      const blockedDevices = [];
      for (const device of devices) {
        const result = await Device.blockIP(device._id, blocked);
        if (result) blockedDevices.push(result);
      }

      console.log(
        blocked
          ? `🔒 Blocked ${blockedDevices.length} devices`
          : `🔓 Unblocked ${blockedDevices.length} devices`,
      );

      res.json({
        success: true,
        message: blocked
          ? `${blockedDevices.length} התקנים נחסמו בהצלחה`
          : `${blockedDevices.length} התקנים הופעלו בהצלחה`,
        data: blockedDevices,
      });
    } catch (error) {
      console.error("❌ Error blocking IP:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },
);

// @desc    Delete device
// @route   DELETE /api/admin/devices/:id
// @access  Private/Admin/ROI
router.delete("/devices/:id", protect, checkAdminOrROI, async (req, res) => {
  try {
    const { id } = req.params;

    console.log("🗑️ Delete Device:", id);

    const result = await Device.delete(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "התקן לא נמצא",
      });
    }

    console.log("✅ Device deleted successfully");

    res.json({
      success: true,
      message: "התקן נמחק בהצלחה",
    });
  } catch (error) {
    console.error("❌ Error deleting device:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
