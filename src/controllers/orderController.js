import Order from "../models/Order.js";
import OrderMongo from "../models/OrderMongo.js";
import UserMongo from "../models/UserMongo.js";

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

    if (
      !["pending", "processing", "shipped", "delivered", "cancelled"].includes(
        status,
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "סטטוס לא תקין. אפשרויות תקינות: pending, processing, shipped, delivered, cancelled",
      });
    }

    const updatedOrder = await Order.updateStatus(id, status);
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
      status: "pending",
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

    const deleted = await Order.delete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "הזמנה לא נמצאה",
      });
    }

    console.log("✅ Order deleted");

    res.json({
      success: true,
      message: "הזמנה נמחקה בהצלחה",
    });
  } catch (error) {
    console.error("❌ Error deleting order:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
