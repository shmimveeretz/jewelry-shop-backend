import Order from "../models/Order.js";
import OrderMongo from "../models/OrderMongo.js";
import {
  getTransactionByPageRequestUid,
  isPayPlusTransactionApproved,
  createManualDocument,
} from "../utils/payPlusAPI.js";
import {
  sendOrderStatusUpdate,
  sendOrderTrackingUpdate,
  ensureOrderEmailsSent,
} from "../utils/emailService.js";
import { saveVerifiedOrder } from "../utils/paidOrder.js";
import { canViewOrder } from "./paymentController.js";

const orderSummary = (order, message) => ({
  success: true,
  message,
  data: order,
  orderId: order.orderId || order._id?.toString(),
  amount: order.totalPrice,
  customerName: order.customerName,
  email: order.customerEmail,
  shippingAddress: order.shippingAddress,
  items: order.items,
});

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
export const getAllOrders = async (req, res) => {
  try {
    const { status } = req.query;

    console.log("📋 Get All Orders Request");
    if (status) console.log("🔍 Filter by status:", status);

    let filter = {};
    if (status) {
      filter.status = status;
    }

    const orders = await Order.findAll(filter);

    res.json({
      success: true,
      data: orders,
      total: orders.length,
    });
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private (owner or admin)
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("🔍 Get Order by ID:", id);

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "הזמנה לא נמצאה",
      });
    }

    if (!canViewOrder(order, req.user)) {
      return res.status(403).json({
        success: false,
        message: "אין לך הרשאה לצפות בהזמנה זו",
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("❌ Error fetching order:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Public order tracking by order number (no auth, no PII)
// @route   GET /api/orders/track/:orderId
// @access  Public
export const trackOrderByOrderId = async (req, res) => {
  try {
    const raw = req.params.orderId?.trim();
    if (!raw || raw.length < 4 || raw.length > 120) {
      return res.status(404).json({
        success: false,
        message: "הזמנה לא נמצאה",
      });
    }

    const order = await Order.findByOrderIdForTracking(raw);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "הזמנה לא נמצאה",
      });
    }

    // Sanitized payload — no email, phone, address, prices, or internal IDs
    res.json({
      success: true,
      data: {
        orderId: order.orderId,
        status: order.status,
        trackingNumber: order.trackingNumber || "",
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items: (order.items || []).map((item) => ({
          name: item.name,
          quantity: item.quantity,
        })),
      },
    });
  } catch (error) {
    console.error("❌ Error tracking order:", error);
    res.status(500).json({
      success: false,
      message: "הזמנה לא נמצאה",
    });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    console.log("🔄 Update Order Status:");
    console.log("📝 Order ID:", id);
    console.log("📊 New Status:", status);

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "סטטוס נדרש",
      });
    }

    const validStatuses = [
      "Pending",
      "Paid",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
    ];

    // Normalize to Title Case to match the Mongoose schema enum
    const normalizedStatus =
      status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

    if (!validStatuses.includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message:
          "סטטוס לא תקין. אפשרויות תקינות: Pending, Paid, Processing, Shipped, Delivered, Cancelled",
      });
    }

    const updatedOrder = await Order.updateStatus(id, normalizedStatus);
    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "הזמנה לא נמצאה",
      });
    }

    console.log("✅ Order status updated to:", status);

    // Notify the customer about the new status (non-blocking)
    const customerEmail = updatedOrder.customerEmail || updatedOrder.email;
    if (customerEmail) {
      sendOrderStatusUpdate(customerEmail, {
        orderId: updatedOrder.orderId || updatedOrder.id,
        status: normalizedStatus,
        customerName:
          updatedOrder.customerName ||
          updatedOrder.shippingAddress?.fullName ||
          "",
        trackingNumber: updatedOrder.trackingNumber || "",
      })
        .then((r) =>
          console.log(
            r.success
              ? `📧 Status update email sent to ${customerEmail}`
              : `❌ Status update email failed: ${r.message}`,
          ),
        )
        .catch((err) =>
          console.error("❌ Status update email error:", err.message),
        );
    } else {
      console.warn(
        `⚠️ No customer email on order ${updatedOrder.orderId || id} — status email skipped`,
      );
    }

    res.json({
      success: true,
      message: "סטטוס ההזמנה עודכן בהצלחה",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("❌ Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update order shipment tracking number
// @route   PUT /api/orders/:id/tracking
// @access  Private/Admin
export const updateOrderTracking = async (req, res) => {
  try {
    const { id } = req.params;
    const trackingNumber = String(req.body.trackingNumber ?? "").trim();

    if (trackingNumber.length > 120) {
      return res.status(400).json({
        success: false,
        message: "מספר מעקב ארוך מדי",
      });
    }

    const existingOrder = await OrderMongo.findById(id).lean();
    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: "הזמנה לא נמצאה",
      });
    }
    const previousTracking = existingOrder.trackingNumber || "";

    const updatedOrder = await Order.update(id, { trackingNumber });
    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "הזמנה לא נמצאה",
      });
    }

    console.log(
      `✅ Tracking number ${trackingNumber ? `set to "${trackingNumber}"` : "cleared"} for order ${id}`,
    );

    // Email the customer the tracking number + quick-track button (non-blocking).
    // Only when a non-empty tracking number was set or changed.
    const customerEmail = updatedOrder.customerEmail || updatedOrder.email;
    let emailSent = false;
    if (trackingNumber && trackingNumber !== previousTracking && customerEmail) {
      emailSent = true;
      sendOrderTrackingUpdate(customerEmail, {
        orderId: updatedOrder.orderId || updatedOrder.id,
        customerName:
          updatedOrder.customerName ||
          updatedOrder.shippingAddress?.fullName ||
          "",
        trackingNumber,
      })
        .then((r) =>
          console.log(
            r.success
              ? `📧 Tracking email sent to ${customerEmail}`
              : `❌ Tracking email failed: ${r.message}`,
          ),
        )
        .catch((err) =>
          console.error("❌ Tracking email error:", err.message),
        );
    }

    res.json({
      success: true,
      message: emailSent
        ? "מספר המעקב עודכן ונשלח ללקוח במייל"
        : "מספר המעקב עודכן בהצלחה",
      emailSent,
      data: updatedOrder,
    });
  } catch (error) {
    console.error("❌ Error updating tracking number:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete order
// @route   DELETE /api/orders/:id
// @access  Private/Admin
export const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("🗑️ Delete Order:", id);

    const deleted = await OrderMongo.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "הזמנה לא נמצאה",
      });
    }

    console.log("✅ Order deleted:", id);

    res.json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting order:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Verify a PayPlus payment server-side and save the order
// @route   POST /api/orders/verify-transaction
// @access  Public (optionalProtect — supports guests)
//
// Called by the success page after PayPlus redirects back. The payment is
// confirmed with PayPlus directly; order contents come from the server-side
// PendingOrder, so nothing in the request body can change what is saved.
export const verifyTransaction = async (req, res) => {
  try {
    const body = req.body || {};
    const pageRequestUid =
      body.paymentPageRequestUid || body.page_request_uid || body.transactionUid || null;

    if (typeof pageRequestUid !== "string" || !pageRequestUid || pageRequestUid.length > 100) {
      return res.status(400).json({
        success: false,
        message: "paymentPageRequestUid הוא שדה חובה",
      });
    }

    const existing = await OrderMongo.findOne({ transactionUid: pageRequestUid });
    if (existing) {
      ensureOrderEmailsSent(existing).catch((err) =>
        console.error("❌ Order email error (verifyTransaction existing):", err.message),
      );
      return res.json(orderSummary(existing, "הזמנה כבר קיימת במערכת"));
    }

    const payPlusResponse = await getTransactionByPageRequestUid(pageRequestUid);
    if (!isPayPlusTransactionApproved(payPlusResponse)) {
      console.warn("⚠️ PayPlus transaction not approved:", pageRequestUid);
      return res.status(402).json({
        success: false,
        message: "התשלום לא אושר על ידי PayPlus",
      });
    }

    const txData =
      payPlusResponse?.transaction ??
      payPlusResponse?.data?.transaction ??
      payPlusResponse?.data ??
      {};

    const { order, created } = await saveVerifiedOrder({
      pageRequestUid,
      txData,
      userId: req.user?.id || null,
    });

    // Fiscal document for this sale (non-blocking). Skipped when the webhook
    // already created the order, since that path owns the document then.
    if (created && order.items.length > 0 && order.totalPrice > 0) {
      createManualDocument("inv_tax_receipt", {
        customer: {
          name: order.customerName,
          email: order.customerEmail,
          phone: order.customerPhone,
        },
        items: order.items.map((i) => ({
          name: i.name,
          quantity: i.quantity ?? 1,
          price: i.price,
        })),
        payments: [{ paymentMethod: 4, sum: Number(order.totalPrice) }],
        totalAmount: Number(order.totalPrice),
        currency_code: "ILS",
        vatType: "vat-type-included",
        language: "he",
        doc_date: new Date().toISOString().slice(0, 10),
        sendEmail: Boolean(order.customerEmail),
      }).catch((err) =>
        console.error("❌ Auto-invoice error (verifyTransaction):", err.message),
      );
    }

    ensureOrderEmailsSent(order).catch((err) =>
      console.error("❌ Order email error (verifyTransaction):", err.message),
    );

    return res.json(orderSummary(order, "התשלום אומת וההזמנה נשמרה בהצלחה"));
  } catch (error) {
    console.error("❌ verifyTransaction Error:", error.message);
    res.status(500).json({ success: false, message: "שגיאה באימות התשלום" });
  }
};

// @desc    Get coupon usage stats (aggregation)
// @route   GET /api/orders/coupon-stats
// @access  Private/Admin
export const getCouponStats = async (req, res) => {
  try {
    console.log("📊 Coupon Stats Request");

    const stats = await OrderMongo.aggregate([
      { $match: { couponCode: { $nin: [null, ""] } } },
      {
        $group: {
          _id: "$couponCode",
          usageCount: { $sum: 1 },
          totalRevenue: { $sum: "$totalPrice" },
        },
      },
      { $sort: { totalRevenue: -1 } },
      {
        $project: {
          _id: 0,
          code: "$_id",
          uses: "$usageCount",
          revenue: "$totalRevenue",
          couponCode: "$_id",
          usageCount: 1,
          totalRevenue: 1,
        },
      },
    ]);

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("❌ Error fetching coupon stats:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
