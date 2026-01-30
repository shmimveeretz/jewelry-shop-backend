import Order from "../models/Order.js";

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
