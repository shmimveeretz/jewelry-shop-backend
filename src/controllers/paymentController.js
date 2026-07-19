import axios from "axios";
import Order from "../models/Order.js";
import OrderMongo from "../models/OrderMongo.js";
import UserMongo from "../models/UserMongo.js";
import PendingOrderMongo from "../models/PendingOrderMongo.js";
import Product from "../models/Product.js";
import ProductMongo from "../models/ProductMongo.js";
import {
  sendCustomerOrderInvoice,
  sendBusinessOwnerOrderNotification,
} from "../utils/emailService.js";
import {
  createPayPlusTransaction,
  generatePaymentLink,
  createManualDocument,
  getTransactionByPageRequestUid,
} from "../utils/payPlusAPI.js";
import { getExtraLetterPerBraceletCost } from "../utils/extraHebrewLetters.js";

// @desc    Verify PayPlus payment and save order to DB
// @route   GET /api/payment/verify/:transactionUid
// @access  Public
export const verifyPayment = async (req, res) => {
  try {
    const { transactionUid } = req.params;
    const orderDataRaw = req.query.orderData;

    if (!transactionUid) {
      return res
        .status(400)
        .json({ success: false, message: "Missing transactionUid" });
    }

    // Idempotency — don't save the same order twice
    const existing = await OrderMongo.findOne({ transactionUid });
    if (existing) {
      return res.json({
        success: true,
        data: existing,
        message: "Order already saved",
      });
    }

    // Parse orderData sent by frontend as query param
    let orderData;
    if (orderDataRaw) {
      try {
        orderData = JSON.parse(decodeURIComponent(orderDataRaw));
      } catch {
        return res
          .status(400)
          .json({ success: false, message: "Invalid orderData format" });
      }
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Missing orderData" });
    }

    // Create the order
    const order = await Order.createFromPayment(orderData, transactionUid);

    // Send confirmation emails (non-blocking)
    const emailData = {
      orderNumber: transactionUid,
      items: order.items,
      shippingAddress: order.shippingAddress,
      itemsPrice: order.itemsPrice,
      taxPrice: 0,
      shippingPrice: order.shippingPrice,
      totalPrice: order.totalPrice,
      paymentInfo: {
        method: "credit_card",
        status: "completed",
        transactionId: transactionUid,
      },
      createdAt: order.createdAt,
      customerEmail: order.customerEmail,
    };

    Promise.all([
      order.customerEmail
        ? sendCustomerOrderInvoice(order.customerEmail, emailData)
        : Promise.resolve(),
      sendBusinessOwnerOrderNotification({ ...emailData, userId: "guest" }),
    ]).catch((err) => console.error("❌ Order email error:", err.message));

    res.json({ success: true, data: order });
  } catch (error) {
    console.error("❌ Verify Payment Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create payment intent with PayPlus
// @route   POST /apicreate-intent
// @access  Private
export const createPaymentIntent = async (req, res) => {
  try {
    const {
      amount,
      currency = "ILS",
      orderItems,
      items,
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
    } = req.body;

    // Generate unique order ID (with or without user)
    const userId = req.user?.id || `guest_${Date.now()}`;
    const orderId = `order_${Date.now()}_${userId}`;
    const frontendBase = (
      process.env.FRONTEND_URL || "https://shamaimveeretz.com"
    ).replace(/\/+$/, "");

    // Build items array for PayPlus invoice
    const sourceItems = orderItems || items;
    const formattedItems =
      sourceItems && sourceItems.length > 0
        ? sourceItems.map((item) => ({
            name: item.name,
            quantity: item.quantity || 1,
            price: item.price,
          }))
        : [{ name: "General Jewelry", quantity: 1, price: req.body.amount }];

    // Derive total directly from items so PayPlus never rejects with
    // "global-price-is-not-equal-to-total-items-sum" due to coupon rounding
    const calculatedTotal = formattedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    // Build customer object for PayPlus invoice
    const customer = {
      customer_name:
        customerName ||
        shippingAddress?.name ||
        shippingAddress?.fullName ||
        "",
      email: customerEmail || shippingAddress?.email || "",
      phone: customerPhone || shippingAddress?.phone || "",
    };

    // Format payload according to PayPlus API spec
    const paymentPayload = {
      payment_page_uid: process.env.PAYPLUS_MERCHANT_ID || "shmimveeretz.com", // Your payment page UID
      charge_method: 1, // 1 = charge only (תשלום בלבד)
      amount: Math.round(calculatedTotal * 100) / 100, // Derived from items — guaranteed to match
      currency_code: currency,
      customer,
      items: formattedItems,
      sendEmailApproval: true,
      sendEmailFailure: false,
      refURL_callback: `${process.env.BACKEND_URL || "http://localhost:5000"}/api/payment/webhook`,
      refURL_success: `${frontendBase}/payment-success`,
      refURL_failure: `${frontendBase}/payment-failure`,
      initial_invoice: true,
      hide_identification_id: false,
      more_info: orderId, // Send order ID in more_info
    };

    console.log(
      "📤 Sending to PayPlus:",
      JSON.stringify(paymentPayload, null, 2),
    );

    const response = await createPayPlusTransaction(paymentPayload);

    console.log("📥 PayPlus response:", JSON.stringify(response, null, 2));

    const paymentUrl = response?.data?.payment_page_link;
    const pageRequestUid = response?.data?.page_request_uid || orderId;

    if (!paymentUrl) {
      throw new Error(
        `PayPlus - Invalid response format. Full: ${JSON.stringify(response)}`,
      );
    }

    // Persist the pending order so the webhook can retrieve it
    // even if the customer's browser never reaches the success page
    if (pageRequestUid) {
      PendingOrderMongo.create({
        pageRequestUid,
        orderData: {
          orderId,
          customerName: customer.customer_name,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          items: (sourceItems || []).map((i) => ({
            productId: i.productId || "",
            name: i.name,
            price: i.price,
            quantity: i.quantity || 1,
            selectedOptions: i.selectedOptions || {},
          })),
          shippingAddress: {
            fullName: customer.customer_name,
            address: shippingAddress?.street || shippingAddress?.address || "",
            city: shippingAddress?.city || "",
            zipCode: shippingAddress?.zipCode || "",
          },
          itemsPrice: req.body.itemsPrice ?? calculatedTotal,
          shippingPrice: req.body.shippingPrice ?? 0,
          totalPrice: req.body.totalPrice ?? calculatedTotal,
          couponCode: req.body.couponCode || null,
          discountPercent: Number(req.body.discountPercent) || 0,
        },
      }).catch((err) =>
        console.error("❌ PendingOrder save error:", err.message),
      );
    }

    res.json({
      success: true,
      paymentPageUrl: paymentUrl,
      transactionUid: pageRequestUid,
      orderId,
    });
  } catch (error) {
    console.error("PayPlus Error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.message || "שגיאה ביצירת עסקה",
      debug: process.env.NODE_ENV !== "production" ? error.message : undefined,
    });
  }
};

// @desc    Create order after successful payment
// @route   POST /apicreate-order
// @access  Public (supports both authenticated users and guests)
export const createOrder = async (req, res) => {
  try {
    // Log what we receive for debugging
    console.log("📥 Received order data:");
    console.log("- Full body:", JSON.stringify(req.body, null, 2));
    console.log("- Items:", req.body.items);
    console.log("- Items length:", req.body.items?.length);
    console.log("- First item:", req.body.items?.[0]);
    console.log("👤 User:", req.user ? req.user.id : "Guest");

    const {
      items,
      shippingAddress,
      paymentInfo,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
      totalAmount, // Alternative field name
      customerEmail, // For guest checkout
      customerName, // For guest checkout
      customerPhone, // For guest checkout
    } = req.body;

    // Normalize data for both formats (old and new)
    const normalizedItems =
      items?.map((item) => ({
        product: item.product || item.productId || item.id,
        productId: item.productId || item.product || item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
        selectedOptions: item.selectedOptions || {},
      })) || [];

    const normalizedShippingAddress = {
      name:
        shippingAddress?.name ||
        shippingAddress?.fullName ||
        customerName ||
        "",
      phone: shippingAddress?.phone || customerPhone || "",
      email: shippingAddress?.email || customerEmail || "",
      street: shippingAddress?.street || shippingAddress?.address || "",
      address: shippingAddress?.address || shippingAddress?.street || "",
      city: shippingAddress?.city || "",
      zipCode: shippingAddress?.zipCode || "",
      country: shippingAddress?.country || "ישראל",
    };

    const normalizedPaymentInfo = paymentInfo || {
      method: "credit_card",
      transactionId: "",
      status: "pending",
    };

    // Use totalAmount if totalPrice is not provided
    const finalTotalPrice = totalPrice || totalAmount || itemsPrice || 0;
    const finalItemsPrice = itemsPrice || finalTotalPrice;
    const finalTaxPrice = taxPrice || 0;
    const finalShippingPrice = shippingPrice || 0;

    // Validate required fields
    if (!normalizedItems || !Array.isArray(normalizedItems)) {
      console.log("❌ Validation failed: Items is not an array");
      return res.status(400).json({
        success: false,
        message: "פורמט פריטים לא תקין.",
        debug: {
          receivedItems: items,
          normalizedItems,
          typeOf: typeof items,
          isArray: Array.isArray(items),
        },
      });
    }

    if (normalizedItems.length === 0) {
      console.log("⚠️ Warning: Empty items array");
      return res.status(400).json({
        success: false,
        message: "לא נמצאו פריטים בהזמנה.",
      });
    }

    if (!normalizedShippingAddress.name || !normalizedShippingAddress.phone) {
      console.log("❌ Validation failed: Missing shipping info");
      return res.status(400).json({
        success: false,
        message: "חסרים פרטי משלוח. אנא מלא שם וטלפון.",
        debug: {
          receivedAddress: shippingAddress,
          normalizedAddress: normalizedShippingAddress,
        },
      });
    }

    // Verify stock availability - skipped (products not in database yet)
    // When products are added to database, uncomment this section
    /* 
    for (let item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `מוצר ${item.name} לא נמצא`,
        });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `אין מספיק מלאי עבור ${product.name}`,
        });
      }
    }
    */

    // Create order (support both authenticated users and guests)
    const order = await Order.create({
      userId: req.user?.id || null, // null for guests
      items: normalizedItems,
      shippingAddress: normalizedShippingAddress,
      paymentInfo: normalizedPaymentInfo,
      itemsPrice: finalItemsPrice,
      taxPrice: finalTaxPrice,
      shippingPrice: finalShippingPrice,
      totalPrice: finalTotalPrice,
    });

    console.log("✅ Order created successfully:", order.orderNumber);

    // Product stock update - skipped (products not in database yet)

    // Cart clearing - skipped for guests
    if (req.user?.id) {
      const User = (await import("../models/User.js")).default;
      await User.clearCart(req.user.id);
      console.log("✅ עגלה נוקתה למשתמש רשום");
    } else {
      console.log("ℹ️ אורח - אין עגלה לנקות");
    }

    // Send order confirmation emails
    try {
      // Determine customer email (from user account or guest email)
      let userEmail = null;
      let user = null;

      if (req.user?.id) {
        // Authenticated user
        const User = (await import("../models/User.js")).default;
        user = await User.findById(req.user.id);
        userEmail = user?.email;
      } else {
        // Guest user - use provided email
        userEmail = customerEmail || normalizedShippingAddress.email;
      }

      // Prepare order data for emails
      const orderEmailData = {
        orderNumber: order.orderNumber,
        items: order.items,
        shippingAddress: order.shippingAddress,
        itemsPrice: order.itemsPrice,
        taxPrice: order.taxPrice,
        shippingPrice: order.shippingPrice,
        totalPrice: order.totalPrice,
        paymentInfo: order.paymentInfo,
        createdAt: order.createdAt,
        userId: req.user?.id || "guest",
        customerEmail: userEmail,
      };

      // Send invoice to customer (if email is provided)
      if (userEmail) {
        await sendCustomerOrderInvoice(userEmail, orderEmailData);
        console.log(`✅ חשבונית נשלחה ללקוח: ${userEmail}`);
      } else {
        console.log("⚠️ לא סופק אימייל ללקוח - החשבונית לא נשלחה");
      }

      // Send notification to business owner
      await sendBusinessOwnerOrderNotification(orderEmailData);
      console.log(`✅ התראה נשלחה לבעל העסק`);
    } catch (emailError) {
      // Log error but don't fail the order creation
      console.error("❌ שגיאה בשליחת מיילים:", emailError.message);
    }

    res.status(201).json({
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

// @desc    Get order by ID
// @route   GET /apiorders/:id
// @access  Private
export const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "הזמנה לא נמצאה",
      });
    }

    // Make sure user is order owner or admin
    if (order.user !== req.user.id && req.user.role !== "admin") {
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
// @route   GET /apimy-orders
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

// @desc    Get all orders (Admin)
// @route   GET /apiorders
// @access  Private/Admin
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.findAll();

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

// @desc    Update order status (Admin)
// @route   PUT /apiorders/:id/status
// @access  Private/Admin
export const updateOrderStatus = async (req, res) => {
  try {
    const { status, note } = req.body;

    const order = await Order.updateStatus(req.params.id, status, note);

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
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Test order creation with demo data (for testing emails)
// @route   POST /apitest-order
// @access  Public (for demo purposes)
export const testOrderDemo = async (req, res) => {
  try {
    const { customerEmail, customerName, customerPhone, items } = req.body;

    // Validate required fields
    if (!customerEmail || !customerName || !customerPhone) {
      return res.status(400).json({
        success: false,
        message: "נא למלא את כל השדות הנדרשים: אימייל, שם וטלפון",
      });
    }

    // Create demo order data
    const demoOrder = {
      orderNumber: `DEMO${Date.now().toString().slice(-6)}`,
      items: items || [
        {
          name: "שרשרת שמע ישראל - זהב",
          quantity: 1,
          price: 450,
        },
        {
          name: "צמיד ברכה - כסף",
          quantity: 2,
          price: 120,
        },
      ],
      shippingAddress: {
        name: customerName,
        phone: customerPhone,
        street: "רחוב הדמו 123",
        city: "תל אביב",
        zipCode: "12345",
        country: "ישראל",
      },
      itemsPrice: items
        ? items.reduce((sum, item) => sum + item.price * item.quantity, 0)
        : 690,
      taxPrice: 0,
      shippingPrice: 30,
      totalPrice: items
        ? items.reduce((sum, item) => sum + item.price * item.quantity, 0) + 30
        : 720,
      paymentInfo: {
        method: "credit_card",
        transactionId: `DEMO_TX_${Date.now()}`,
        status: "completed",
      },
      createdAt: new Date().toISOString(),
      userId: "demo_user_id",
      customerEmail: customerEmail,
    };

    console.log("🧪 יוצר הזמנת דמה לבדיקת מיילים...");

    // Send order confirmation emails
    try {
      // Send invoice to customer
      await sendCustomerOrderInvoice(customerEmail, demoOrder);
      console.log(`✅ חשבונית נשלחה ללקוח: ${customerEmail}`);

      // Send notification to business owner
      await sendBusinessOwnerOrderNotification(demoOrder);
      console.log(`✅ התראה נשלחה לבעל העסק`);

      res.status(200).json({
        success: true,
        message: "הזמנת דמה נוצרה והמיילים נשלחו בהצלחה! 🎉",
        data: {
          orderNumber: demoOrder.orderNumber,
          customerEmail,
          totalPrice: demoOrder.totalPrice,
          emailsSent: {
            customer: true,
            businessOwner: true,
          },
        },
      });
    } catch (emailError) {
      console.error("❌ שגיאה בשליחת מיילים:", emailError.message);
      res.status(500).json({
        success: false,
        message: "שגיאה בשליחת המיילים",
        error: emailError.message,
      });
    }
  } catch (error) {
    console.error("❌ שגיאה כללית:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Debug endpoint - see what data is received
// @route   POST /apidebug-order
// @access  Public
export const debugOrder = async (req, res) => {
  try {
    console.log(
      "🔍 DEBUG - Full request body:",
      JSON.stringify(req.body, null, 2),
    );
    console.log("🔍 DEBUG - User:", req.user ? req.user.id : "No user (Guest)");

    res.json({
      success: true,
      message: "Debug info - check server console",
      receivedData: {
        body: req.body,
        hasUser: !!req.user,
        userId: req.user?.id || null,
        hasItems: !!req.body.items,
        itemsCount: req.body.items?.length || 0,
        hasShippingAddress: !!req.body.shippingAddress,
        hasCustomerEmail: !!req.body.customerEmail,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Handle PayPlus server-to-server callback
// @route   POST /api/payment/webhook
// @access  Public (called by PayPlus, never by the browser)
//
// PayPlus POSTs here after every transaction attempt.
// We respond 200 immediately (otherwise PayPlus retries), then
// save the order asynchronously using the PendingOrder we stored
// when the payment link was created.
export const payPlusWebhook = async (req, res) => {
  // Respond immediately — PayPlus requires a fast 200
  res.status(200).send("OK");

  try {
    // PayPlus wraps the data in a `transaction` key in newer versions
    const transaction = req.body?.transaction ?? req.body ?? {};

    const pageRequestUid =
      transaction.payment_page_request_uid ||
      transaction.page_request_uid ||
      null;

    const statusCode = transaction.status_code ?? null;
    const isApproved =
      statusCode === "000" ||
      statusCode === 0 ||
      statusCode === "0" ||
      transaction.status === "approved" ||
      transaction.payment_status === "completed";

    console.log("📩 PayPlus Webhook received:");
    console.log("  page_request_uid:", pageRequestUid);
    console.log("  status_code:", statusCode, "| approved:", isApproved);

    if (!isApproved) {
      console.warn(`⚠️ Webhook: not approved — status_code: ${statusCode}`);
      return;
    }

    if (!pageRequestUid) {
      console.warn("⚠️ Webhook: no page_request_uid in payload", req.body);
      return;
    }

    // Idempotency — skip if browser already saved the order
    const existing = await OrderMongo.findOne({
      transactionUid: pageRequestUid,
    });
    if (existing) {
      console.log(`ℹ️ Webhook: order already exists for ${pageRequestUid}`);
      return;
    }

    // Retrieve the pending order we stored before redirecting to PayPlus
    const pendingDoc = await PendingOrderMongo.findOne({ pageRequestUid });
    const orderData = pendingDoc?.orderData ?? {};

    // Fall back to data in the webhook payload if pendingOrder is missing
    const customerName =
      orderData.customerName ||
      transaction.customer_name ||
      transaction.full_name ||
      "לקוח";
    const customerEmail =
      orderData.customerEmail ||
      transaction.email ||
      transaction.customer_email ||
      "";
    const customerPhone =
      orderData.customerPhone ||
      transaction.phone ||
      transaction.customer_phone ||
      "";
    const totalPrice =
      orderData.totalPrice ??
      orderData.totalAmount ??
      Number(transaction.amount) ??
      0;

    const items =
      orderData.items ??
      (transaction.items || []).map((i) => ({
        productId: "",
        name: i.name,
        price: Number(i.price),
        quantity: Number(i.quantity) || 1,
        selectedOptions: {},
      }));

    const publicOrderId =
      orderData.orderId ||
      transaction.more_info ||
      pageRequestUid;

    const newOrder = await OrderMongo.create({
      customerName,
      customerEmail,
      customerPhone,
      items,
      shippingAddress: {
        fullName: orderData.shippingAddress?.fullName || customerName,
        address: orderData.shippingAddress?.address || "",
        city: orderData.shippingAddress?.city || "",
        zipCode: orderData.shippingAddress?.zipCode || "",
      },
      itemsPrice: Number(orderData.itemsPrice) || 0,
      shippingPrice: Number(orderData.shippingPrice) || 0,
      totalPrice: Number(totalPrice),
      couponCode: orderData.couponCode || null,
      discountPercent: Number(orderData.discountPercent) || 0,
      paymentStatus: "completed",
      transactionUid: pageRequestUid,
      orderId: publicOrderId,
      status: "Pending",
    });

    console.log(
      `✅ Webhook: order saved — id: ${newOrder._id}, orderId: ${publicOrderId}, uid: ${pageRequestUid}`,
    );

    // Clean up pending order (best-effort)
    pendingDoc?.deleteOne().catch(() => {});

    const emailPayload = {
      orderNumber: publicOrderId,
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
        transactionId: pageRequestUid,
      },
      createdAt: newOrder.createdAt,
      userId: null,
      customerEmail,
    };

    Promise.all([
      customerEmail
        ? sendCustomerOrderInvoice(customerEmail, emailPayload)
        : Promise.resolve(),
      sendBusinessOwnerOrderNotification(emailPayload),
    ]).catch((err) =>
      console.error("❌ Webhook order email failed:", err.message),
    );
  } catch (error) {
    console.error("❌ Webhook processing error:", error.message);
    // Response already sent — just log
  }
};

// @desc    Generate a PayPlus payment link (with initial_invoice: true)
// @route   POST /api/payment/generate-link
// @access  Public
export const generatePaymentLinkHandler = async (req, res) => {
  try {
    const {
      amount,
      currency_code,
      description,
      customerName,
      customerEmail,
      customerPhone,
      moreInfo,
      items,
      successUrl,
      failureUrl,
    } = req.body;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "amount חייב להיות מספר חיובי" });
    }

    // ── Server-side price revalidation ────────────────────────────────────────
    // If each item carries a productId, we re-fetch the price from the DB so the
    // frontend can never manipulate the charged amount.
    let validatedItems = Array.isArray(items) ? items : [];
    let serverTotal = 0;

    const hasProductIds =
      validatedItems.length > 0 && validatedItems[0]?.productId;

    if (hasProductIds) {
      validatedItems = await Promise.all(
        validatedItems.map(async (item) => {
          const product = await ProductMongo.findOne({ id: item.productId });
          if (!product) {
            throw new Error(`מוצר לא נמצא: ${item.productId}`);
          }

          const sel = item.selections || item.selectedOptions || {};
          const metalType = sel.metalType ?? "";
          const jewelryType = sel.jewelryType ?? "";
          const extraLetters = Array.isArray(sel.extraLetters)
            ? sel.extraLetters
            : [];

          const metalAddition =
            product.priceAdditions?.metalType?.[metalType] ?? 0;

          let extraLettersCost = 0;
          if (product.id === "letter-chain") {
            const perLetter = getExtraLetterPerBraceletCost(
              product.priceAdditions,
              metalType,
            );
            extraLettersCost = extraLetters.length * perLetter;
          } else if (jewelryType === "צמיד") {
            const perLetter = getExtraLetterPerBraceletCost(
              product.priceAdditions,
              metalType,
            );
            extraLettersCost = extraLetters.length * perLetter;
          }

          const unitPrice =
            (product.price ?? 0) + metalAddition + extraLettersCost;

          return {
            ...item,
            name: item.name || product.name,
            price: unitPrice,
          };
        }),
      );

      serverTotal = validatedItems.reduce(
        (sum, item) => sum + item.price * (Number(item.quantity) || 1),
        0,
      );
    }

    // Use the server-computed total when available; otherwise trust the provided amount
    const resolvedAmount =
      serverTotal > 0 ? Math.round(serverTotal * 100) / 100 : Number(amount);

    const result = await generatePaymentLink({
      amount: resolvedAmount,
      currency_code,
      description,
      customerName,
      customerEmail,
      customerPhone,
      moreInfo,
      items: validatedItems,
      successUrl,
      failureUrl,
      notifyUrl: `${process.env.BACKEND_URL || "http://localhost:5000"}/api/payment/webhook`,
    });

    res.json({
      success: true,
      paymentPageUrl: result.paymentPageUrl,
      pageRequestUid: result.pageRequestUid,
    });
  } catch (error) {
    console.error("❌ generatePaymentLinkHandler:", error.message);
    res.status(500).json({ success: false, message: error.message });
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
