import mongoose from "mongoose";

const DeviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    deviceName: String,
    userAgent: String,
    browser: String,
    os: String,
    screen: String,
    language: String,
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

// Unique per user+IP when userId exists; unique per IP alone for anonymous visitors
DeviceSchema.index(
  { userId: 1, ipAddress: 1 },
  { unique: true, partialFilterExpression: { userId: { $exists: true } } },
);
DeviceSchema.index(
  { ipAddress: 1 },
  { unique: true, partialFilterExpression: { userId: { $exists: false } } },
);

export default mongoose.model("Device", DeviceSchema);
