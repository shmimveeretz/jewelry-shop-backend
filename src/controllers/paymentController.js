import crypto from "crypto";
import Order from "../models/Order.js";
import PendingOrderMongo from "../models/PendingOrderMongo.js";
import { ensureOrderEmailsSent } from "../utils/emailService.js";
import {
  createPayPlusTransaction,
  createManualDocument,
} from "../utils/payPlusAPI.js";
import { priceCart } from "../utils/orderPricing.js";
import { saveVerifiedOrder } from "../utils/paidOrder.js";
import { buildBackendUrl } from "../utils/backendUrl.js";
import { isStoreClosedForShabbat } from "../utils/shabbat.js";

const trimTo = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

// @desc    Create a PayPlus payment page for the current cart
// @route   POST /api/payment/create-intent
// @access  Public (guests can pay; a logged-in user is linked to the order)
//
// Every amount is recomputed from the database by priceCart. Prices, totals
// and discount percentages in the request body are ignored on purpose.
export const createPaymentIntent = async (req, res) => {
  try {
    const {
      orderItems,
      items,
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      couponCode,
    } = req.body;

    if (await isStoreClosedForShabbat()) {
      return res.status(423).json({
        success: false,
        closedForShabbat: true,
        message: "האתר סגור בשבת ובחג. נשמח לקבל את הזמנתך מיד עם צאת השבת או החג.",
      });
    }

    const cart = await priceCart(orderItems || items, couponCode || null, {
      country: shippingAddress?.country,
    });

    const userId = req.user?.id || null;
    const orderId = `order_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const frontendBase = (
      process.env.FRONTEND_URL || "https://shamaimveeretz.com"
    ).replace(/\/+$/, "");

    const customer = {
      customer_name: trimTo(customerName || shippingAddress?.name || shippingAddress?.fullName, 120),
      email: trimTo(customerEmail || shippingAddress?.email, 200),
      phone: trimTo(customerPhone || shippingAddress?.phone, 30),
    };

    if (!customer.customer_name || !/^\S+@\S+\.\S+$/.test(customer.email)) {
      return res.status(400).json({
        success: false,
        message: "נא להזין שם מלא וכתובת אימייל תקינה",
      });
    }

    const address = trimTo(shippingAddress?.street || shippingAddress?.address, 200);
    const city = trimTo(shippingAddress?.city, 100);
    if (!address || !city) {
      return res.status(400).json({
        success: false,
        message: "נא להזין כתובת ועיר למשלוח",
      });
    }

    // Shipping is its own invoice line, so PayPlus' item sum equals the amount
    const invoiceItems = cart.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    }));
    if (cart.shipping.price > 0) {
      invoiceItems.push({ name: "משלוח", quantity: 1, price: cart.shipping.price });
    }

    const paymentPayload = {
      payment_page_uid: process.env.PAYPLUS_MERCHANT_ID,
      charge_method: 1, // 1 = charge only
      amount: cart.totalPrice,
      currency_code: "ILS",
      customer,
      items: invoiceItems,
      sendEmailApproval: true,
      sendEmailFailure: false,
      refURL_callback: buildBackendUrl("/api/payment/webhook"),
      refURL_success: `${frontendBase}/payment-success`,
      refURL_failure: `${frontendBase}/payment-failure`,
      initial_invoice: true,
      hide_identification_id: false,
      more_info: orderId,
    };

    const response = await createPayPlusTransaction(paymentPayload);

    const paymentUrl = response?.data?.payment_page_link;
    const pageRequestUid = response?.data?.page_request_uid;

    if (!paymentUrl || !pageRequestUid) {
      console.error("PayPlus returned no payment link:", JSON.stringify(response));
      throw new Error("שגיאה ביצירת עמוד תשלום");
    }

    // Persisted before redirecting so the webhook can build the order even if
    // the customer never returns to the success page.
    await PendingOrderMongo.create({
      pageRequestUid,
      orderData: {
        orderId,
        userId,
        customerName: customer.customer_name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        items: cart.items,
        shippingAddress: {
          fullName: customer.customer_name,
          address,
          city,
          zipCode: trimTo(shippingAddress?.zipCode, 20),
          country: cart.shipping.country,
        },
        itemsPrice: cart.itemsPrice,
        shippingPrice: cart.shipping.price,
        totalPrice: cart.totalPrice,
        couponCode: cart.coupon?.code || null,
        discountPercent: cart.coupon?.discountPercent || 0,
      },
    });

    res.json({
      success: true,
      paymentPageUrl: paymentUrl,
      transactionUid: pageRequestUid,
      orderId,
      totalPrice: cart.totalPrice,
      shippingPrice: cart.shipping.price,
    });
  } catch (error) {
    console.error("PayPlus Error:", error.response?.data || error.message);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "שגיאה ביצירת עסקה",
    });
  }
};

/** Order owners and staff may read an order; everyone else gets a 403. */
export function canViewOrder(order, user) {
  if (!order || !user) return false;
  if (user.role === "admin" || user.role === "roi") return true;
  const ownerId = order.userId?._id ?? order.userId;
  return Boolean(ownerId) && String(ownerId) === String(user.id);
}

// @desc    Get order by ID
// @route   GET /api/payment/orders/:id
// @access  Private (owner or admin)
export const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

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
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get user orders
// @route   GET /api/payment/my-orders
// @access  Private
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.findByUserId(req.user.id);

    res.json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * PayPlus signs each callback: header `hash` = base64(HMAC-SHA256(body, secret)).
 * The raw bytes are checked first; JSON.stringify of the parsed body is the
 * fallback PayPlus' own sample uses.
 */
function isSignedByPayPlus(req) {
  const secret = process.env.PAYPLUS_SECRET_KEY;
  const received = req.headers.hash;
  if (!secret || typeof received !== "string" || !received) return false;

  const candidates = [req.rawBody, JSON.stringify(req.body)].filter(Boolean);
  const receivedBuf = Buffer.from(received);

  return candidates.some((message) => {
    const expected = Buffer.from(
      crypto.createHmac("sha256", secret).update(message).digest("base64"),
    );
    return (
      expected.length === receivedBuf.length &&
      crypto.timingSafeEqual(expected, receivedBuf)
    );
  });
}

// @desc    Handle PayPlus server-to-server callback
// @route   POST /api/payment/webhook
// @access  PayPlus only (HMAC signed)
export const payPlusWebhook = async (req, res) => {
  if (!isSignedByPayPlus(req)) {
    console.warn("🚫 Rejected unsigned/invalid PayPlus webhook from", req.ip);
    return res.status(401).send("Invalid signature");
  }

  // Respond immediately — PayPlus retries on slow responses
  res.status(200).send("OK");

  try {
    const transaction = req.body?.transaction ?? req.body ?? {};
    const pageRequestUid =
      transaction.payment_page_request_uid || transaction.page_request_uid || null;
    const statusCode = String(transaction.status_code ?? "");

    if (statusCode !== "000") {
      console.warn(`⚠️ Webhook: not approved — status_code: ${statusCode}`);
      return;
    }
    if (!pageRequestUid) {
      console.warn("⚠️ Webhook: no page_request_uid in payload");
      return;
    }

    const { order, created } = await saveVerifiedOrder({
      pageRequestUid,
      txData: transaction,
    });

    if (created) {
      console.log(`✅ Webhook: order saved — ${order.orderId} (${pageRequestUid})`);
    }

    ensureOrderEmailsSent(order).catch((err) =>
      console.error("❌ Webhook order email failed:", err.message),
    );
  } catch (error) {
    console.error("❌ Webhook processing error:", error.message);
  }
};

// @desc    Create a fiscal document via PayPlus Books API
// @route   POST /api/payment/documents/:docType
// @access  Private/Admin
export const createDocumentHandler = async (req, res) => {
  try {
    const { docType } = req.params;
    const {
      customer,
      items,
      payments,
      totalAmount,
      currency_code,
      vatType,
      remarks,
      sendEmail,
    } = req.body;

    if (!customer?.name) {
      return res
        .status(400)
        .json({ success: false, message: "customer.name הוא שדה חובה" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "items הוא שדה חובה ולא יכול להיות ריק",
      });
    }
    if (totalAmount == null || isNaN(Number(totalAmount))) {
      return res
        .status(400)
        .json({ success: false, message: "totalAmount הוא שדה חובה" });
    }

    // Normalize vatType: accept legacy numbers (0/1) or correct string enums
    const vatTypeMap = {
      0: "vat-type-not-included",
      1: "vat-type-included",
      2: "vat-type-exempt",
    };
    const normalizedVatType =
      typeof vatType === "number"
        ? (vatTypeMap[vatType] ?? "vat-type-included")
        : (vatType ?? "vat-type-included");

    const result = await createManualDocument(docType, {
      customer,
      items,
      payments,
      totalAmount: Number(totalAmount),
      currency_code,
      vatType: normalizedVatType,
      remarks,
      sendEmail: sendEmail !== false, // default true
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error("❌ createDocumentHandler:", error.message);
    const status =
      error.message.startsWith("Invalid docType") ||
      error.message.startsWith("Invalid vatType")
        ? 400
        : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};
