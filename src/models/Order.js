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
          "pending",
          "processing",
          "shipped",
          "delivered",
          "cancelled",
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

  formatOrder(order) {
    return {
      id: order._id.toString(),
      _id: order._id.toString(),
      orderId: order.orderId,
      userId: order.userId?._id || order.userId,
      customerName: order.customerName,
      email: order.email,
      items: order.items,
      totalPrice: order.totalPrice,
      status: order.status,
      shippingAddress: order.shippingAddress,
      paymentMethod: order.paymentMethod,
      notes: order.notes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}

export default new OrderModel();
