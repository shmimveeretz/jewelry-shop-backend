import DeviceMongo from "./DeviceMongo.js";

class DeviceModel {
  constructor() {
    this.Model = DeviceMongo;
  }

  async create(deviceData) {
    try {
      const { userId, ipAddress, deviceName, userAgent, location } = deviceData;

      if (!userId || !ipAddress) {
        throw new Error("userId ו-ipAddress נדרשים");
      }

      const newDevice = await this.Model.create({
        userId,
        ipAddress,
        deviceName,
        userAgent,
        location,
        loginCount: 1,
        firstLogin: new Date(),
        lastLogin: new Date(),
      });

      return this.formatDevice(newDevice);
    } catch (error) {
      throw error;
    }
  }

  async findByUserAndIP(userId, ipAddress) {
    try {
      const device = await this.Model.findOne({ userId, ipAddress }).populate(
        "userId",
        "firstName lastName email",
      );
      if (!device) return null;
      return this.formatDevice(device);
    } catch (error) {
      throw error;
    }
  }

  async updateLastLogin(userId, ipAddress) {
    try {
      const device = await this.Model.findOneAndUpdate(
        { userId, ipAddress },
        {
          lastLogin: new Date(),
          $inc: { loginCount: 1 },
          updatedAt: new Date(),
        },
        { new: true },
      ).populate("userId", "firstName lastName email");

      return device ? this.formatDevice(device) : null;
    } catch (error) {
      throw error;
    }
  }

  async findAll(filter = {}) {
    try {
      const devices = await this.Model.find(filter)
        .populate("userId", "firstName lastName email")
        .sort({ lastLogin: -1 });

      return devices.map((device) => this.formatDevice(device));
    } catch (error) {
      throw error;
    }
  }

  async findById(id) {
    try {
      const device = await this.Model.findById(id).populate(
        "userId",
        "firstName lastName email",
      );
      if (!device) return null;
      return this.formatDevice(device);
    } catch (error) {
      throw error;
    }
  }

  async blockIP(id, blocked) {
    try {
      const device = await this.Model.findByIdAndUpdate(
        id,
        { blocked, updatedAt: new Date() },
        { new: true },
      ).populate("userId", "firstName lastName email");

      if (!device) return null;
      return this.formatDevice(device);
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

  async isIPBlocked(ipAddress) {
    try {
      const device = await this.Model.findOne({ ipAddress, blocked: true });
      return device ? true : false;
    } catch (error) {
      throw error;
    }
  }

  formatDevice(device) {
    return {
      id: device._id.toString(),
      _id: device._id.toString(),
      userId: device.userId?._id || device.userId,
      ipAddress: device.ipAddress,
      deviceName: device.deviceName,
      userAgent: device.userAgent,
      location: device.location,
      blocked: device.blocked,
      loginCount: device.loginCount,
      lastLogin: device.lastLogin,
      firstLogin: device.firstLogin,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    };
  }
}

export default new DeviceModel();
