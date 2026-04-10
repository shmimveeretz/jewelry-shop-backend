import mongoose from "mongoose";

const DeviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    deviceName: String,
    userAgent: String,
    location: {
      country: String,
      city: String,
      latitude: Number,
      longitude: Number,
      timezone: String,
    },
    blocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    loginCount: {
      type: Number,
      default: 1,
    },
    lastLogin: Date,
    firstLogin: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: "devices" },
);

// Create unique index for userId + ipAddress
DeviceSchema.index({ userId: 1, ipAddress: 1 }, { unique: true });

export default mongoose.model("Device", DeviceSchema);
