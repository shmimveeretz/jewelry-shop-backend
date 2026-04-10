import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    first"name": {
      type: String,
      required: true,
    },
    last"name": {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
    },
    role: {
      type: String,
      enum: ["user", "customer", "admin", "roi"],
      default: "user",
    },
    blocked: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: "users" },
);

export default mongoose.model("User", UserSchema);
