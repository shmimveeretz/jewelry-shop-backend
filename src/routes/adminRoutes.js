import express from "express";
import { protect } from "../middleware/auth.js";
import Device from "../models/Device.js";
import Order from "../models/Order.js";
import OrderMongo from "../models/OrderMongo.js";
import NewsletterMongo from "../models/NewsletterMongo.js";
import { createManualDocument } from "../utils/payPlusAPI.js";

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

// ─── Stats ───────────────────────────────────────────────────────────────────

// @desc    Get dashboard statistics
// @route   GET /api/admin/stats?period=week|month|year|all
// @access  Private/Admin/ROI
router.get("/stats", protect, checkAdminOrROI, async (req, res) => {
  try {
    const { period = "month" } = req.query;

    const now = new Date();
    let since;
    switch (period) {
      case "week":
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        since = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        since = null; // all time
    }

    const dateFilter = since ? { createdAt: { $gte: since } } : {};

    const [allOrders, periodOrders, newsletterCount] = await Promise.all([
      OrderMongo.find({}).select("totalPrice status createdAt"),
      OrderMongo.find(dateFilter).select("totalPrice status createdAt"),
      NewsletterMongo.countDocuments(),
    ]);

    const totalRevenue = allOrders.reduce(
      (sum, o) => sum + (o.totalPrice || 0),
      0,
    );
    const periodRevenue = periodOrders.reduce(
      (sum, o) => sum + (o.totalPrice || 0),
      0,
    );

    const statusCounts = {};
    for (const o of allOrders) {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    }

    res.json({
      success: true,
      data: {
        period,
        totalOrders: allOrders.length,
        periodOrders: periodOrders.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        periodRevenue: Math.round(periodRevenue * 100) / 100,
        ordersByStatus: statusCounts,
        newsletterSubscribers: newsletterCount,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching stats:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Orders ──────────────────────────────────────────────────────────────────

// @desc    Get all orders (with optional status filter)
// @route   GET /api/admin/orders
// @access  Private/Admin/ROI
router.get("/orders", protect, checkAdminOrROI, async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;

    console.log("📋 Admin Get All Orders");
    if (status) console.log("🔍 Filter by status:", status);

    const filter = {};
    if (status) filter.status = status;

    const orders = await Order.findAll(filter);
    const paginatedOrders = orders.slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      data: paginatedOrders,
      total: orders.length,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get single order by ID
// @route   GET /api/admin/orders/:id
// @access  Private/Admin/ROI
router.get("/orders/:id", protect, checkAdminOrROI, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "הזמנה לא נמצאה" });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    console.error("❌ Error fetching order:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Update order status
// @route   PUT /api/admin/orders/:id/status
// @access  Private/Admin/ROI
router.put("/orders/:id/status", protect, checkAdminOrROI, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = [
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `סטטוס לא תקין. אפשרויות: ${validStatuses.join(", ")}`,
      });
    }

    const updated = await Order.updateStatus(id, status);
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "הזמנה לא נמצאה" });
    }

    console.log(`✅ Order ${id} status → ${status}`);
    res.json({
      success: true,
      message: "סטטוס ההזמנה עודכן בהצלחה",
      data: updated,
    });
  } catch (error) {
    console.error("❌ Error updating order status:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Generate a quick tax invoice (חשבונית מס) for an existing order via PayPlus Books
// @route   POST /api/admin/orders/:id/invoice
// @access  Private/Admin/ROI
router.post(
  "/orders/:id/invoice",
  protect,
  checkAdminOrROI,
  async (req, res) => {
    try {
      const { id } = req.params;
      // Allow caller to override doc type; default to tax receipt (חשבונית מס קבלה)
      const { docType = "inv_tax_receipt", sendEmail = true } = req.body;

      const order = await Order.findById(id);
      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "הזמנה לא נמצאה" });
      }

      console.log(`🧾 Generating invoice [${docType}] for order:`, id);

      const result = await createManualDocument(docType, {
        customer: {
          name: order.customerName,
          email: order.customerEmail || order.email || "",
          phone: order.customerPhone || "",
        },
        items: (order.items || []).map((item) => ({
          name: item.name,
          quantity: item.quantity ?? 1,
          price: item.price,
        })),
        payments: [{ paymentMethod: 4, sum: order.totalPrice }], // 4 = credit card
        totalAmount: order.totalPrice,
        currency_code: "ILS",
        vatType: "Vat-type-included",
        language: "He",
        doc_date: new Date().toISOString().slice(0, 10),
        transactionUid: order.transactionUid || undefined,
        sendEmail,
      });

      console.log("✅ Invoice created successfully");
      res.json({ success: true, data: result });
    } catch (error) {
      console.error("❌ Error generating invoice:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

export default router;
