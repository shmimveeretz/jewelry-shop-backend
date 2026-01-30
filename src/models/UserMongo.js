import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "נא להזין שם פרטי"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "נא להזין שם משפחה"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "נא להזין כתובת אימייל"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "נא להזין כתובת אימייל תקינה"],
    },
    password: {
      type: String,
      required: [true, "נא להזין סיסמה"],
      minlength: [6, "הסיסמה חייבת להכיל לפחות 6 תווים"],
      select: false, // Don't return password by default
    },
    phone: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ["user", "customer", "admin", "roi"], // תמיכה גם ב-user הישן וגם ב-customer החדש, ו-roi החדש
      default: "customer",
    },
    blocked: {
      type: Boolean,
      default: false,
      description: "האם המשתמש חסום מהחנות",
    },
    shippingDetails: {
      fullName: String,
      phone: String,
      address: String,
      city: String,
      zipCode: String,
      country: {
        type: String,
        default: "ישראל",
      },
    },
    cart: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        name: String,
        price: Number,
        quantity: Number,
        image: String,
      },
    ],
    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    orders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
    ],
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationCode: String,
    verificationCodeExpire: Date,
  },
  {
    timestamps: true,
  },
);

// Validate password format
const validatePasswordFormat = (password) => {
  const regex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
  return regex.test(password);
};

// Hash password before saving
userSchema.pre("save", async function () {
  // רק hash סיסמה אם היא שונתה
  if (!this.isModified("password")) {
    return;
  }

  // Validate password format
  if (!validatePasswordFormat(this.password)) {
    throw new Error(
      "הסיסמה חייבת להכיל לפחות 8 תווים, אות גדולה, אות קטנה וסימן מיוחד",
    );
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error;
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate JWT Token
userSchema.methods.generateToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "30d",
  });
};

// Clear cart
userSchema.methods.clearCart = async function () {
  this.cart = [];
  await this.save();
};

// Update shipping details
userSchema.methods.updateShippingDetails = async function (shippingDetails) {
  this.shippingDetails = shippingDetails;
  await this.save();
  return this;
};

const User = mongoose.model("User", userSchema);

export default User;
