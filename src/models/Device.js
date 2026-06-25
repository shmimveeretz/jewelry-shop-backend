import DeviceMongo from "./DeviceMongo.js";
import { normalizeIP } from "../utils/clientIp.js";

class DeviceModel {
  constructor() {
    this.Model = DeviceMongo;
  }

  async create(deviceData) {
    try {
      const { userId, ipAddress, deviceName, userAgent, location } = deviceData;

      const normalizedIP = normalizeIP(ipAddress);
      if (!userId || !normalizedIP) {
        throw new Error("userId ו-ipAddress נדרשים");
      }

      const newDevice = await this.Model.create({
        userId,
        ipAddress: normalizedIP,
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
      const normalizedIP = normalizeIP(ipAddress);
      const device = await this.Model.findOne({
        userId,
        ipAddress: normalizedIP,
      }).populate(
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
      const normalizedIP = normalizeIP(ipAddress);
      const device = await this.Model.findOneAndUpdate(
        { userId, ipAddress: normalizedIP },
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
      const target = await this.Model.findById(id);
      if (!target) return null;

      const ipAddress = normalizeIP(target.ipAddress);
      await this.Model.updateMany(
        { ipAddress },
        { blocked, updatedAt: new Date() },
      );

      const device = await this.Model.findById(id).populate(
        "userId",
        "firstName lastName email",
      );

      return this.formatDevice(device);
    } catch (error) {
      throw error;
    }
  }

  async blockByIPAddress(ipAddress, blocked) {
    try {
      const normalizedIP = normalizeIP(ipAddress);
      if (!normalizedIP) return null;

      const updateResult = await this.Model.updateMany(
        { ipAddress: normalizedIP },
        { blocked, updatedAt: new Date() },
      );

      if (updateResult.matchedCount === 0 && blocked) {
        const created = await this.Model.create({
          ipAddress: normalizedIP,
          blocked: true,
          loginCount: 0,
          firstLogin: new Date(),
          lastLogin: new Date(),
        });
        return this.formatDevice(created);
      }

      const device = await this.Model.findOne({ ipAddress: normalizedIP }).sort({
        blocked: -1,
        lastLogin: -1,
      });

      return device ? this.formatDevice(device) : null;
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
      const normalized = normalizeIP(ipAddress);
      if (!normalized) return false;

      const device = await this.Model.findOne({
        ipAddress: normalized,
        blocked: true,
      });
      return Boolean(device);
    } catch (error) {
      throw error;
    }
  }

  async findAnonymousByIP(ipAddress) {
    try {
      const normalizedIP = normalizeIP(ipAddress);
      const device = await this.Model.findOne({
        ipAddress: normalizedIP,
        userId: { $exists: false },
      });
      return device || null;
    } catch (error) {
      throw error;
    }
  }

  async claimDevice(anonDevice, userId, deviceName, userAgent) {
    try {
      anonDevice.userId = userId;
      if (deviceName)
        anonDevice.deviceName = anonDevice.deviceName || deviceName;
      if (userAgent) anonDevice.userAgent = anonDevice.userAgent || userAgent;
      anonDevice.lastLogin = new Date();
      anonDevice.loginCount = (anonDevice.loginCount || 0) + 1;
      await anonDevice.save();
      return this.formatDevice(anonDevice);
    } catch (error) {
      throw error;
    }
  }

  async track(deviceData) {
    try {
      const { ipAddress, location, deviceName, browser, os, screen, language } =
        deviceData;

      const normalizedIP = normalizeIP(ipAddress);
      if (!normalizedIP) {
        throw new Error("ipAddress נדרש");
      }

      const existing = await this.Model.findOne({ ipAddress: normalizedIP });

      if (existing) {
        const updated = await this.Model.findOneAndUpdate(
          { ipAddress: normalizedIP },
          {
            $inc: { loginCount: 1 },
            lastLogin: new Date(),
            ...(location && { location }),
            ...(deviceName && { deviceName }),
            ...(browser && { browser }),
            ...(os && { os }),
            ...(screen && { screen }),
            ...(language && { language }),
            updatedAt: new Date(),
          },
          { new: true },
        );
        return this.formatDevice(updated);
      } else {
        const created = await this.Model.create({
          ipAddress: normalizedIP,
          location,
          deviceName,
          browser,
          os,
          screen,
          language,
          loginCount: 1,
          firstLogin: new Date(),
          lastLogin: new Date(),
        });
        return this.formatDevice(created);
      }
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
      browser: device.browser,
      os: device.os,
      screen: device.screen,
      language: device.language,
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
