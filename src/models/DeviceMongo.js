import mongoose from "mongoose";

const deviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "ID של המשתמש נדרש"],
      index: true,
    },
    ipAddress: {
      type: String,
      required: [true, "כתובת IP נדרשת"],
      index: true,
    },
    deviceName: {
      type: String,
      default: "Unknown Device",
    },
    userAgent: {
      type: String,
    },
    location: {
      country: { type: String, default: "Unknown" },
      city: { type: String, default: "Unknown" },
      latitude: Number,
      longitude: Number,
      timezone: { type: String, default: "Unknown" },
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
    lastLogin: {
      type: Date,
      default: Date.now,
      index: true,
    },
    firstLogin: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Create unique index for userId + ipAddress combination
deviceSchema.index({ userId: 1, ipAddress: 1 }, { unique: true });

const Device = mongoose.model("Device", deviceSchema);

export default Device;
