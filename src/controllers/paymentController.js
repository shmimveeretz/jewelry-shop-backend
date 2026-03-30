import axios from "axios";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import {
  sendCustomerOrderInvoice,
  sendBusinessOwnerOrderNotification,
} from "../utils/emailService.js";
import { createPayPlusTransaction } from "../utils/payPlusAPI.js";

// @desc    Create payment intent with PayPlus
// @route   POST /api/payment/create-intent
// @access  Private
export const createPaymentIntent = async (req, res) => {
  try {
    const { amount, currency = "ILS", orderItems = [] } = req.body;

    // Generate unique order ID (with or without user)
    const userId = req.user?.id || `guest_${Date.now()}`;
    const orderId = `order_${Date.now()}_${userId}`;

    // Format payload according to PayPlus API spec
    const paymentPayload = {
      payment_page_uid: process.env.PAYPLUS_MERCHANT_ID || "shmimveeretz.com", // Your payment page UID
      charge_method: 1, // 1 = charge only (תשלום בלבד)
      amount: Math.round(amount * 100) / 100, // Amount in shekels
      currency_code: currency,
      sendEmailApproval: true,
      sendEmailFailure: false,
      refURL_callback: `${process.env.BACKEND_URL || "http://localhost:5000"}/api/payment/webhook`,
      initial_invoice: true,
      hide_identification_id: false,
      more_info: orderId, // Send order ID in more_info
    };

    console.log(
      "📤 Sending to PayPlus:",
      JSON.stringify(paymentPayload, null, 2),
    );

    const response = await createPayPlusTransaction(paymentPayload);

    console.log("📥 PayPlus Response:", response);

    if (response && (response.url || response.link)) {
      res.json({
        success: true,
        data: {
          transactionId: response.id || response.transactionId || orderId,
          paymentUrl: response.url || response.link || response.paymentUrl,
          orderId: orderId,
        },
      });
    } else {
      throw new Error("PayPlus - Invalid response format");
    }
  } catch (error) {
    console.error("PayPlus Error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.message || "שגיאה ביצירת עסקה",
    });
  }
};

// @desc    Create order after successful payment
// @route   POST /api/payment/create-order
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
// @route   GET /api/payment/orders/:id
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

// @desc    Get all orders (Admin)
// @route   GET /api/payment/orders
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
// @route   PUT /api/payment/orders/:id/status
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
// @route   POST /api/payment/test-order
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
// @route   POST /api/payment/debug-order
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

// @desc    Handle PayPlus webhook
// @route   POST /api/payment/webhook
// @access  Public
export const payPlusWebhook = async (req, res) => {
  try {
    const { eventType, data } = req.body;

    // Verify webhook signature
    if (!data || !data.transactionId) {
      return res.status(400).json({
        success: false,
        message: "Invalid webhook data",
      });
    }

    // Handle different event types
    switch (eventType) {
      case "transaction.approved":
        console.log("✅ PayPlus Payment Approved:", data.transactionId);
        // Update order status to 'paid'
        if (data.orderId) {
          await Order.updatePaymentStatus(
            data.orderId,
            "completed",
            data.transactionId,
          );

          // Send order confirmation emails after payment approval
          try {
            const order = await Order.findById(data.orderId);
            if (order) {
              const User = (await import("../models/User.js")).default;
              const user = await User.findById(order.userId || order.user);

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
                userId: order.userId || order.user,
                customerEmail: user?.email,
              };

              // Send invoice to customer
              if (user?.email) {
                await sendCustomerOrderInvoice(user.email, orderEmailData);
                console.log(`✅ חשבונית נשלחה ללקוח: ${user.email}`);
              }

              // Send notification to business owner
              await sendBusinessOwnerOrderNotification(orderEmailData);
              console.log(`✅ התראה נשלחה לבעל העסק`);
            }
          } catch (emailError) {
            console.error("❌ שגיאה בשליחת מיילים:", emailError.message);
          }
        }
        break;

      case "transaction.declined":
        console.log("❌ PayPlus Payment Declined:", data.transactionId);
        if (data.orderId) {
          await Order.updatePaymentStatus(
            data.orderId,
            "failed",
            data.transactionId,
          );
        }
        break;

      case "transaction.pending":
        console.log("⏳ PayPlus Payment Pending:", data.transactionId);
        if (data.orderId) {
          await Order.updatePaymentStatus(
            data.orderId,
            "pending",
            data.transactionId,
          );
        }
        break;

      default:
        console.log(`Unhandled PayPlus event type: ${eventType}`);
    }

    res.json({ success: true, received: true });
  } catch (error) {
    console.error("Webhook Error:", error.message);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
