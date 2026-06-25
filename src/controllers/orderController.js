import Order from "../models/Order.js";
import OrderMongo from "../models/OrderMongo.js";
import UserMongo from "../models/UserMongo.js";
import ProductMongo from "../models/ProductMongo.js";
import {
  getTransactionByPageRequestUid,
  createManualDocument,
} from "../utils/payPlusAPI.js";
import { sendBusinessOwnerOrderNotification } from "../utils/emailService.js";
import {
  normalizeExtraHebrewLetters,
  isValidHebrewLetter,
  getExtraLetterPerBraceletCost,
} from "../utils/extraHebrewLetters.js";

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

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
export const createOrder = async (req, res) => {
  try {
    const {
      orderId,
      customerName,
      email,
      items,
      totalPrice,
      shippingAddress,
      paymentMethod,
      notes,
    } = req.body;
    const userId = req.user.id;

    console.log("📦 Create Order Request:");
    console.log("📝 Order ID:", orderId);
    console.log("👤 Customer:", customerName);

    if (
      !orderId ||
      !customerName ||
      !email ||
      !items ||
      items.length === 0 ||
      !totalPrice
    ) {
      return res.status(400).json({
        success: false,
        message: "כל השדות החובה נדרשים",
      });
    }

    const newOrder = await Order.create({
      orderId,
      userId,
      customerName,
      email,
      items,
      totalPrice,
      shippingAddress,
      paymentMethod,
      notes,
    });

    console.log("✅ Order created:", orderId);

    res.status(201).json({
      success: true,
      message: "הזמנה נוצרה בהצלחה",
      data: newOrder,
    });
  } catch (error) {
    console.error("❌ Error creating order:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
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

// @desc    Handle successful payment — save order + link to user
// @route   POST /api/orders/success
// @access  Public (optionalProtect — works for guests too)
export const orderSuccess = async (req, res) => {
  try {
    const {
      // Payment gateway fields
      paymentTransactionId,
      transactionUid,
      // Customer info
      customerName,
      customerEmail,
      customerPhone,
      // Items
      items,
      // Pricing
      totalAmount,
      totalPrice,
      itemsPrice,
      shippingPrice,
      discountPercent,
      couponCode,
      // Shipping
      shippingAddress,
    } = req.body;

    const resolvedTransactionUid =
      transactionUid || paymentTransactionId || null;
    const resolvedTotal = totalPrice ?? totalAmount;

    if (!customerName || !customerEmail) {
      return res.status(400).json({
        success: false,
        message: "customerName ו-customerEmail הם שדות חובה",
      });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "items הוא שדה חובה" });
    }
    if (resolvedTotal == null || isNaN(Number(resolvedTotal))) {
      return res
        .status(400)
        .json({ success: false, message: "totalAmount הוא שדה חובה" });
    }

    // Idempotency — avoid saving the same transaction twice
    if (resolvedTransactionUid) {
      const existing = await OrderMongo.findOne({
        transactionUid: resolvedTransactionUid,
      });
      if (existing) {
        return res.json({
          success: true,
          data: existing,
          message: "הזמנה כבר קיימת במערכת",
        });
      }
    }

    const orderData = {
      customerName,
      customerEmail,
      customerPhone: customerPhone || "",
      items: items.map((item) => ({
        productId: item.productId || item.id || "",
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity ?? 1,
        selectedOptions: item.selectedOptions || {},
      })),
      shippingAddress: {
        fullName:
          shippingAddress?.fullName || shippingAddress?.name || customerName,
        address: shippingAddress?.address || shippingAddress?.street || "",
        city: shippingAddress?.city || "",
        zipCode: shippingAddress?.zipCode || "",
      },
      itemsPrice: Number(itemsPrice) || 0,
      shippingPrice: Number(shippingPrice) || 0,
      totalPrice: Number(resolvedTotal),
      couponCode: couponCode || null,
      discountPercent: Number(discountPercent) || 0,
      paymentStatus: "completed",
      transactionUid: resolvedTransactionUid,
      status: "Pending",
    };

    // Link to authenticated user when logged in
    if (req.user?.id) {
      orderData.userId = req.user.id;
    }

    const saved = await OrderMongo.create(orderData);

    // Attach order reference to user document if authenticated
    if (req.user?.id) {
      await UserMongo.findByIdAndUpdate(req.user.id, {
        $push: { orders: saved._id },
        updatedAt: Date.now(),
      });
    }

    console.log(
      `✅ Order saved via /success — id: ${saved._id}, tx: ${resolvedTransactionUid || "N/A"}, user: ${
        req.user?.id || "guest"
      }`,
    );

    return res.status(200).json({
      success: true,
      message: "ההזמנה נשמרה בהצלחה",
      data: saved,
    });
  } catch (error) {
    console.error("❌ orderSuccess Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
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
export const verifyTransaction = async (req, res) => {
  try {
    const { paymentPageRequestUid, orderData: orderDataFromBody } = req.body;

    if (!paymentPageRequestUid) {
      return res.status(400).json({
        success: false,
        message: "paymentPageRequestUid הוא שדה חובה",
      });
    }

    // Idempotency — avoid saving the same transaction twice
    const existing = await OrderMongo.findOne({
      transactionUid: paymentPageRequestUid,
    });
    if (existing) {
      return res.json({
        success: true,
        data: existing,
        message: "הזמנה כבר קיימת במערכת",
      });
    }

    // Verify the payment server-side with PayPlus
    console.log("🔍 Verifying transaction:", paymentPageRequestUid);
    const payPlusResponse = await getTransactionByPageRequestUid(
      paymentPageRequestUid,
    );

    // PayPlus returns results.status 1 for approved transactions
    const txStatus =
      payPlusResponse?.results?.status ?? payPlusResponse?.data?.status ?? null;
    const isApproved =
      txStatus === 1 ||
      txStatus === "1" ||
      txStatus === "approved" ||
      payPlusResponse?.data?.payment_status === "completed";

    if (!isApproved) {
      console.warn("⚠️ PayPlus transaction not approved:", payPlusResponse);
      return res.status(402).json({
        success: false,
        message: "התשלום לא אושר על ידי PayPlus",
        details: payPlusResponse?.results ?? payPlusResponse,
      });
    }

    // Build order from PayPlus data + optional orderData from frontend
    const txData = payPlusResponse?.data ?? {};
    const orderData = orderDataFromBody ?? {};

    const customerName =
      orderData.customerName ||
      txData.customer_name ||
      txData.full_name ||
      "לקוח";
    const customerEmail =
      orderData.customerEmail || txData.email || txData.customer_email || "";
    const customerPhone =
      orderData.customerPhone || txData.phone || txData.customer_phone || "";
    const totalPrice =
      orderData.totalPrice ??
      orderData.totalAmount ??
      Number(txData.amount) ??
      0;

    const items =
      orderData.items ??
      (txData.items || []).map((i) => ({
        productId: i.product_uid || "",
        name: i.name,
        price: Number(i.price),
        quantity: Number(i.quantity) || 1,
        selectedOptions: {},
      }));

    const newOrder = await OrderMongo.create({
      customerName,
      customerEmail,
      customerPhone,
      items,
      shippingAddress: {
        fullName:
          orderData.shippingAddress?.fullName ||
          orderData.shippingAddress?.name ||
          customerName,
        address:
          orderData.shippingAddress?.address ||
          orderData.shippingAddress?.street ||
          "",
        city: orderData.shippingAddress?.city || "",
        zipCode: orderData.shippingAddress?.zipCode || "",
      },
      itemsPrice: Number(orderData.itemsPrice) || 0,
      shippingPrice: Number(orderData.shippingPrice) || 0,
      totalPrice: Number(totalPrice),
      couponCode: orderData.couponCode || null,
      discountPercent: Number(orderData.discountPercent) || 0,
      paymentStatus: "completed",
      transactionUid: paymentPageRequestUid,
      status: "Pending",
      ...(req.user?.id && { userId: req.user.id }),
    });

    // Link order to authenticated user
    if (req.user?.id) {
      await UserMongo.findByIdAndUpdate(req.user.id, {
        $push: { orders: newOrder._id },
        updatedAt: Date.now(),
      });
    }

    // Auto-generate tax receipt via PayPlus Books (non-blocking)
    if (items.length > 0 && totalPrice > 0) {
      const today = new Date().toISOString().slice(0, 10);
      createManualDocument("inv_tax_receipt", {
        customer: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
        },
        items: items.map((i) => ({
          name: i.name,
          quantity: i.quantity ?? 1,
          price: i.price,
        })),
        payments: [{ paymentMethod: 4, sum: Number(totalPrice) }],
        totalAmount: Number(totalPrice),
        currency_code: "ILS",
        vatType: "Vat-type-included",
        language: "He",
        doc_date: today,
        transactionUid: paymentPageRequestUid,
        sendEmail: !!customerEmail,
      }).catch((err) =>
        console.error(
          "❌ Auto-invoice error (verifyTransaction):",
          err.message,
        ),
      );
    }

    console.log(
      `✅ Transaction verified & order saved — id: ${newOrder._id}, uid: ${paymentPageRequestUid}`,
    );

    // Notify business owner (non-blocking — never fails the response)
    sendBusinessOwnerOrderNotification({
      orderNumber: newOrder._id.toString(),
      items: items.map((i) => ({
        productId: i.productId || "",
        name: i.name,
        price: i.price,
        quantity: i.quantity ?? 1,
        selectedOptions: i.selectedOptions || {},
      })),
      shippingAddress: {
        name: newOrder.shippingAddress?.fullName || customerName,
        phone: customerPhone,
        street: newOrder.shippingAddress?.address || "",
        city: newOrder.shippingAddress?.city || "",
        zipCode: newOrder.shippingAddress?.zipCode || "",
        country: "ישראל",
      },
      itemsPrice: newOrder.itemsPrice,
      taxPrice: 0,
      shippingPrice: newOrder.shippingPrice,
      totalPrice,
      paymentInfo: {
        method: "credit_card",
        transactionId: paymentPageRequestUid,
      },
      createdAt: newOrder.createdAt,
      userId: req.user?.id || null,
      customerEmail,
    }).catch((err) =>
      console.error("❌ Admin order notification failed:", err.message),
    );

    return res.status(200).json({
      success: true,
      message: "התשלום אומת וההזמנה נשמרה בהצלחה",
      data: newOrder,
    });
  } catch (error) {
    console.error("❌ verifyTransaction Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
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

// @desc    Save full order from frontend localStorage after successful payment
// @route   POST /api/orders/create-from-payment
// @access  Public (optionalProtect — supports guests)
export const createFromPayment = async (req, res) => {
  try {
    const { transactionUid } = req.body;

    if (!transactionUid) {
      return res.status(400).json({
        success: false,
        message: "transactionUid הוא שדה חובה",
      });
    }

    // Idempotency — don't save the same transaction twice
    const existing = await OrderMongo.findOne({ transactionUid });
    if (existing) {
      return res.json({
        success: true,
        data: existing,
        message: "הזמנה כבר קיימת במערכת",
      });
    }

    const order = await Order.createFromPayment(req.body, transactionUid);

    console.log(
      `✅ createFromPayment: order saved — id: ${order._id ?? order.id}, uid: ${transactionUid}`,
    );

    return res.status(201).json({ success: true, data: order });
  } catch (error) {
    console.error("❌ createFromPayment Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Validate a single cart item and calculate its price server-side.
 *          Frontend prices are NEVER trusted — we re-compute from the DB.
 * @route   POST /api/orders/cart/add
 * @access  Public
 *
 * Expected body:
 * {
 *   "productId": "aleph",
 *   "quantity": 1,
 *   "selections": {
 *     "metalType": "זהב 14 קראט",
 *     "length": "45",
 *     "jewelryType": "צמיד",
 *     "extraLetters": ["ב", "ג", "ד"]
 *   }
 * }
 */
export const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, selections = {} } = req.body;

    // ── Input validation ────────────────────────────────────────────────────
    if (!productId || typeof productId !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "productId הוא שדה חובה" });
    }

    const parsedQty = Number(quantity);
    if (!Number.isInteger(parsedQty) || parsedQty < 1) {
      return res.status(400).json({
        success: false,
        message: "quantity חייב להיות מספר שלם חיובי",
      });
    }

    // ── Fetch product from DB ────────────────────────────────────────────────
    const product = await ProductMongo.findOne({ id: productId });
    if (!product) {
      return res.status(404).json({ success: false, message: "מוצר לא נמצא" });
    }

    const {
      metalType = "",
      length = "",
      jewelryType = "",
      extraLetters = [],
    } = selections;

    if (!Array.isArray(extraLetters)) {
      return res.status(400).json({
        success: false,
        message: "extraLetters חייב להיות מערך",
      });
    }

    const normalizedExtraLetters = normalizeExtraHebrewLetters(extraLetters);

    // ── Validate Hebrew letters ──────────────────────────────────────────────
    const invalidLetters = normalizedExtraLetters.filter(
      (l) => !isValidHebrewLetter(l),
    );
    if (invalidLetters.length > 0) {
      return res.status(400).json({
        success: false,
        message: `extraLetters מכיל תווים לא חוקיים: "${invalidLetters.join('", "')}". ניתן להשתמש באותיות עבריות בלבד (א–ת)`,
      });
    }

    // ── Server-side price calculation ────────────────────────────────────────
    const basePrice = product.price ?? 0;
    const metalAddition = product.priceAdditions?.metalType?.[metalType] ?? 0;

    let extraLettersCost = 0;
    let sanitizedExtraLetters = [];

    if (product.id === "letter-chain") {
      sanitizedExtraLetters = normalizedExtraLetters;
      const perLetterCost = getExtraLetterPerBraceletCost(
        product.priceAdditions,
        metalType,
      );
      extraLettersCost = sanitizedExtraLetters.length * perLetterCost;
    } else if (jewelryType === "צמיד") {
      sanitizedExtraLetters = normalizedExtraLetters;
      const perLetterCost = getExtraLetterPerBraceletCost(
        product.priceAdditions,
        metalType,
      );
      extraLettersCost = sanitizedExtraLetters.length * perLetterCost;
    }
    // For non-bracelet types, extraLetters is intentionally discarded

    const unitPrice = basePrice + metalAddition + extraLettersCost;

    const cartItem = {
      productId: product.id,
      name: product.name,
      price: unitPrice,
      quantity: parsedQty,
      selections: {
        metalType,
        length,
        jewelryType,
        extraLetters: sanitizedExtraLetters,
      },
    };

    console.log(
      `🛒 addToCart: ${product.name} — unit price: ${unitPrice} ILS (base ${basePrice} + metal ${metalAddition} + letters ${extraLettersCost})`,
    );

    return res.status(200).json({ success: true, data: cartItem });
  } catch (error) {
    console.error("❌ addToCart Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
