import express from "express";
import { protect } from "../middleware/auth.js";
import Order from "../models/Order.js";
import OrderMongo from "../models/OrderMongo.js";
import NewsletterMongo from "../models/NewsletterMongo.js";
import UserMongo from "../models/UserMongo.js";
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

    const [
      allOrders,
      currentOrders,
      previousOrders,
      currentUsers,
      previousUsers,
      newsletterCount,
      products,
    ] = await Promise.all([
      OrderMongo.find({}).select("totalPrice status createdAt category"),
      OrderMongo.find(currentFilter).select("totalPrice status createdAt"),
      OrderMongo.find(previousFilter).select("totalPrice status createdAt"),
      UserMongo.countDocuments(currentFilter),
      UserMongo.countDocuments(previousFilter),
      NewsletterMongo.countDocuments({ active: { $ne: false } }),
      ProductMongo.find({}).select("category"),
    ]);

    // Cancelled orders are refunded/never fulfilled: not revenue
    const sumRevenue = (orders) =>
      Math.round(
        orders
          .filter((o) => o.status !== "Cancelled")
          .reduce((sum, o) => sum + (o.totalPrice || 0), 0) * 100,
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
