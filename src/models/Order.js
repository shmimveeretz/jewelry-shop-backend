import OrderMongo from "./OrderMongo.js";

class OrderModel {
  constructor() {
    this.Model = OrderMongo;
  }

  async create(orderData) {
    try {
      const {
        orderId,
        userId,
        customerName,
        email,
        items,
        totalPrice,
        shippingAddress,
        paymentMethod,
        notes,
      } = orderData;

      // Validate required fields
      if (
        !orderId ||
        !userId ||
        !customerName ||
        !email ||
        !items ||
        !totalPrice
      ) {
        throw new Error("כל השדות החובה נדרשים");
      }

      const newOrder = await this.Model.create({
        orderId,
        userId,
        customerName,
        email,
        items,
        totalPrice,
        shippingAddress,
        paymentMethod,
        notes,
        status: "pending",
      });

      return this.formatOrder(newOrder);
    } catch (error) {
      throw error;
    }
  }

  async findById(id) {
    try {
      const order = await this.Model.findById(id).populate(
        "userId",
        "firstName lastName email",
      );
      if (!order) return null;
      return this.formatOrder(order);
    } catch (error) {
      throw error;
    }
  }

  async findByOrderId(orderId) {
    try {
      const order = await this.Model.findOne({ orderId }).populate(
        "userId",
        "firstName lastName email",
      );
      if (!order) return null;
      return this.formatOrder(order);
    } catch (error) {
      throw error;
    }
  }

  /** Public tracking lookup — no populate, orderId is the customer-facing tracker */
  async findByOrderIdForTracking(orderId) {
    try {
      const order = await this.Model.findOne({ orderId }).lean();
      if (!order) return null;
      return {
        orderId: order.orderId,
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items: order.items,
      };
    } catch (error) {
      throw error;
    }
  }

  async findAll(filter = {}) {
    try {
      const orders = await this.Model.find(filter)
        .populate("userId", "firstName lastName email")
        .sort({ createdAt: -1 });
      return orders.map((order) => this.formatOrder(order));
    } catch (error) {
      throw error;
    }
  }

  async findByUserId(userId) {
    try {
      const orders = await this.Model.find({ userId })
        .populate("userId", "firstName lastName email")
        .sort({ createdAt: -1 });
      return orders.map((order) => this.formatOrder(order));
    } catch (error) {
      throw error;
    }
  }

  async updateStatus(id, status) {
    try {
      if (
        ![
          "Pending",
          "Paid",
          "Processing",
          "Shipped",
          "Delivered",
          "Cancelled",
        ].includes(status)
      ) {
        throw new Error("סטטוס לא תקין");
      }

      const order = await this.Model.findByIdAndUpdate(
        id,
        { status, updatedAt: Date.now() },
        { new: true },
      ).populate("userId", "firstName lastName email");

      if (!order) return null;
      return this.formatOrder(order);
    } catch (error) {
      throw error;
    }
  }

  async update(id, updateData) {
    try {
      const order = await this.Model.findByIdAndUpdate(
        id,
        { ...updateData, updatedAt: Date.now() },
        { new: true },
      ).populate("userId", "firstName lastName email");

      if (!order) return null;
      return this.formatOrder(order);
    } catch (error) {
      throw error;
    }
  }

  async delete(id) {
    try {
      const result = await this.Model.findByIdAndDelete(id);
      return result ? true : false;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create order from verified PayPlus payment (new flow)
   */
  async createFromPayment(orderData, transactionUid) {
    try {
      const doc = await this.Model.create({
        customerName: orderData.customerName,
        customerEmail: orderData.customerEmail,
        customerPhone: orderData.customerPhone || "",
        items: (orderData.items || []).map((item) => ({
          productId: item.productId || item.id || "",
          name: item.name,
          price: item.price,
          quantity: item.quantity || 1,
          selectedOptions: item.selectedOptions || {},
        })),
        shippingAddress: {
          fullName:
            orderData.shippingAddress?.fullName || orderData.customerName,
          address: orderData.shippingAddress?.address || "",
          city: orderData.shippingAddress?.city || "",
          zipCode: orderData.shippingAddress?.zipCode || "",
        },
        itemsPrice: orderData.itemsPrice || 0,
        shippingPrice: orderData.shippingPrice || 0,
        totalPrice: orderData.totalPrice,
        couponCode: orderData.couponCode || null,
        discountPercent: orderData.discountPercent || 0,
        paymentStatus: "completed",
        transactionUid,
        orderId: transactionUid,
        status: "Pending",
      });
      return this.formatOrder(doc);
    } catch (error) {
      throw error;
    }
  }

  formatOrder(order) {
    return {
      id: order._id.toString(),
      _id: order._id.toString(),
      orderId: order.orderId,
      userId: order.userId?._id || order.userId,
      customerName: order.customerName,
      customerEmail: order.customerEmail || order.email,
      customerPhone: order.customerPhone,
      email: order.email || order.customerEmail,
      items: order.items,
      shippingAddress: order.shippingAddress,
      itemsPrice: order.itemsPrice,
      shippingPrice: order.shippingPrice,
      totalPrice: order.totalPrice,
      couponCode: order.couponCode,
      discountPercent: order.discountPercent,
      paymentStatus: order.paymentStatus,
      transactionUid: order.transactionUid,
      status: order.status,
      paymentMethod: order.paymentMethod,
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}

export default new OrderModel();
