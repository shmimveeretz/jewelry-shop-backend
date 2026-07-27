import express from "express";
import { protect } from "../middleware/auth.js";
import Device from "../models/Device.js";
import { getClientIP, normalizeIP } from "../utils/clientIp.js";
import Order from "../models/Order.js";
import OrderMongo from "../models/OrderMongo.js";
import NewsletterMongo from "../models/NewsletterMongo.js";
import UserMongo from "../models/UserMongo.js";
import DeviceMongo from "../models/DeviceMongo.js";
import ProductMongo from "../models/ProductMongo.js";
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
    const { location, deviceName, browser, os, screen, language } = req.body;
    const ipAddress = getClientIP(req);

    if (!ipAddress || ipAddress === "UNKNOWN") {
      return res.status(400).json({
        success: false,
        message: "לא ניתן לזהות כתובת IP",
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

      const normalizedIP = normalizeIP(decodeURIComponent(ipAddress));
      if (!normalizedIP) {
        return res.status(400).json({
          success: false,
          message: "כתובת IP לא תקינה",
        });
      }

      const blockedDevice = await Device.blockByIPAddress(normalizedIP, blocked);
      if (!blockedDevice) {
        return res.status(404).json({
          success: false,
          message: "לא ניתן לעדכן חסימה עבור כתובת IP זו",
        });
      }

      console.log(
        blocked
          ? `🔒 Blocked IP ${normalizedIP}`
          : `🔓 Unblocked IP ${normalizedIP}`,
      );

      res.json({
        success: true,
        message: blocked
          ? `כתובת IP ${normalizedIP} נחסמה בהצלחה`
          : `חסימת כתובת IP ${normalizedIP} בוטלה בהצלחה`,
        data: blockedDevice,
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

function calcTrend(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function getPeriodRanges(period) {
  const now = new Date();
  const ms = {
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
  };

  const duration = ms[period] || ms.month;
  const currentStart = new Date(now.getTime() - duration);
  const previousStart = new Date(currentStart.getTime() - duration);

  return { now, currentStart, previousStart, duration };
}

function buildTimeBuckets(period, currentStart, now) {
  const buckets = [];
  if (period === "day") {
    for (let i = 23; i >= 0; i--) {
      const end = new Date(now.getTime() - i * 60 * 60 * 1000);
      const start = new Date(end.getTime() - 60 * 60 * 1000);
      buckets.push({
        label: end.toLocaleTimeString("he-IL", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        start,
        end,
      });
    }
    return buckets;
  }

  const days = period === "week" ? 7 : period === "year" ? 12 : 30;
  const stepMs =
    period === "year"
      ? 30 * 24 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000;

  for (let i = days - 1; i >= 0; i--) {
    const end = new Date(now.getTime() - i * stepMs);
    const start = new Date(end.getTime() - stepMs);
    buckets.push({
      label:
        period === "year"
          ? end.toLocaleDateString("he-IL", { month: "short" })
          : end.toLocaleDateString("he-IL", { day: "numeric", month: "short" }),
      start,
      end,
    });
  }
  return buckets;
}

// @desc    Get dashboard statistics
// @route   GET /api/admin/stats?period=day|week|month|year|all
// @access  Private/Admin/ROI
router.get("/stats", protect, checkAdminOrROI, async (req, res) => {
  try {
    const { period = "week" } = req.query;
    const { now, currentStart, previousStart } = getPeriodRanges(
      period === "all" ? "month" : period,
    );

    const currentFilter = { createdAt: { $gte: currentStart, $lte: now } };
    const previousFilter = {
      createdAt: { $gte: previousStart, $lt: currentStart },
    };
    const deviceCurrentFilter = {
      lastLogin: { $gte: currentStart, $lte: now },
    };
    const devicePreviousFilter = {
      lastLogin: { $gte: previousStart, $lt: currentStart },
    };

    const [
      allOrders,
      currentOrders,
      previousOrders,
      currentUsers,
      previousUsers,
      currentVisits,
      previousVisits,
      totalVisitors,
      newsletterCount,
      products,
    ] = await Promise.all([
      OrderMongo.find({}).select("totalPrice status createdAt category"),
      OrderMongo.find(currentFilter).select("totalPrice status createdAt"),
      OrderMongo.find(previousFilter).select("totalPrice status createdAt"),
      UserMongo.countDocuments(currentFilter),
      UserMongo.countDocuments(previousFilter),
      DeviceMongo.countDocuments(deviceCurrentFilter),
      DeviceMongo.countDocuments(devicePreviousFilter),
      DeviceMongo.countDocuments({}),
      NewsletterMongo.countDocuments({ active: { $ne: false } }),
      ProductMongo.find({}).select("category"),
    ]);

    const sumRevenue = (orders) =>
      Math.round(
        orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0) * 100,
      ) / 100;

    const currentRevenue = sumRevenue(currentOrders);
    const previousRevenue = sumRevenue(previousOrders);

    const statusCounts = {};
    for (const o of allOrders) {
      const key = o.status || "Pending";
      statusCounts[key] = (statusCounts[key] || 0) + 1;
    }

    const categoryCounts = {};
    for (const p of products) {
      if (!p.category) continue;
      categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
    }

    const buckets = buildTimeBuckets(
      period === "all" ? "month" : period,
      currentStart,
      now,
    );
    const revenueOverTime = buckets.map((bucket) => {
      const bucketOrders = currentOrders.filter(
        (o) => o.createdAt >= bucket.start && o.createdAt <= bucket.end,
      );
      return {
        label: bucket.label,
        revenue: sumRevenue(bucketOrders),
        orders: bucketOrders.length,
      };
    });

    res.json({
      success: true,
      data: {
        period,
        orders: {
          count: currentOrders.length,
          trend: calcTrend(currentOrders.length, previousOrders.length),
        },
        revenue: {
          total: currentRevenue,
          trend: calcTrend(currentRevenue, previousRevenue),
        },
        newUsers: {
          count: currentUsers,
          trend: calcTrend(currentUsers, previousUsers),
        },
        visits: {
          count: currentVisits,
          trend: calcTrend(currentVisits, previousVisits),
          total: totalVisitors,
        },
        totalOrders: allOrders.length,
        totalRevenue: sumRevenue(allOrders),
        periodOrders: currentOrders.length,
        periodRevenue: currentRevenue,
        ordersByStatus: statusCounts,
        newsletterSubscribers: newsletterCount,
        charts: {
          revenueOverTime,
          ordersByStatus: Object.entries(statusCounts).map(([status, count]) => ({
            status,
            count,
          })),
          productsByCategory: Object.entries(categoryCounts).map(
            ([category, count]) => ({ category, count }),
          ),
        },
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
      "Pending",
      "Paid",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
    ];
    const normalizedStatus =
      status?.charAt(0).toUpperCase() + status?.slice(1).toLowerCase();

    if (!status || !validStatuses.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: `סטטוס לא תקין. אפשרויות: ${validStatuses.join(", ")}`,
      });
    }

    const updated = await Order.updateStatus(id, normalizedStatus);
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "הזמנה לא נמצאה" });
    }

    console.log(`✅ Order ${id} status → ${normalizedStatus}`);
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
        vatType: "vat-type-included",
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
