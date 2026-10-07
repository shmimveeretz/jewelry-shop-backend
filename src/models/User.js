import UserMongo from "./UserMongo.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$/;
const PASSWORD_FORMAT_ERROR =
  "הסיסמה חייבת להכיל לפחות 8 תווים, אות גדולה, אות קטנה וסימן מיוחד";

/**
 * Before this fix, password resets saved the new password unhashed. Those
 * accounts still log in: the plain value is compared in constant time and the
 * caller re-hashes it on success (see login).
 */
const comparePlainLegacy = (entered, stored) => {
  const a = Buffer.from(String(entered));
  const b = Buffer.from(String(stored));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Validate password format
const validatePasswordFormat = (password) => {
  const regex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
  return regex.test(password);
};

class UserModel {
  constructor() {
    this.Model = UserMongo;
  }

  async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  }

  async comparePassword(enteredPassword, hashedPassword) {
    if (typeof enteredPassword !== "string" || typeof hashedPassword !== "string") {
      return false;
    }
    if (!BCRYPT_HASH_RE.test(hashedPassword)) {
      return comparePlainLegacy(enteredPassword, hashedPassword);
    }
    return await bcrypt.compare(enteredPassword, hashedPassword);
  }

  isHashed(storedPassword) {
    return typeof storedPassword === "string" && BCRYPT_HASH_RE.test(storedPassword);
  }

  async create(userData) {
    try {
      const {
        firstName,
        lastName,
        email,
        password,
        phone,
        isSubscribedToNewsletter,
      } = userData;

      // Validate required fields
      if (!firstName || !lastName) {
        throw new Error("נא להזין שם פרטי ושם משפחה");
      }

      if (!/^\S+@\S+\.\S+$/.test(email)) {
        throw new Error("נא להזין כתובת אימייל תקינה");
      }

      // Validate password format
      if (!validatePasswordFormat(password)) {
        throw new Error(
          "הסיסמה חייבת להכיל לפחות 8 תווים, אות גדולה, אות קטנה וסימן מיוחד",
        );
      }

      const existingUser = await this.Model.findOne({
        email: email.toLowerCase(),
      });
      if (existingUser) {
        throw new Error("משתמש עם אימייל זה כבר קיים");
      }

      const hashedPassword = await this.hashPassword(password);

      const newUser = await this.Model.create({
        firstName,
        lastName,
        email: email.toLowerCase(),
        password: hashedPassword,
        phone: phone || "",
        role: "user",
        cart: [],
        wishlist: [],
        orders: [],
        isSubscribedToNewsletter: isSubscribedToNewsletter !== false, // default true
      });

      return {
        id: newUser._id.toString(),
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        blocked: newUser.blocked,
        isSubscribedToNewsletter: newUser.isSubscribedToNewsletter,
        cart: newUser.cart,
        wishlist: newUser.wishlist,
        orders: newUser.orders,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
      };
    } catch (error) {
      throw error;
    }
  }

  async findById(id, includePassword = false) {
    try {
      let query = this.Model.findById(id);
      if (includePassword) {
        query = query.select("+password");
      }
      const user = await query;
      if (!user) return null;

      return {
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        blocked: user.blocked,
        cart: user.cart,
        wishlist: user.wishlist,
        orders: user.orders,
        verificationCode: user.verificationCode,
        verificationCodeExpire: user.verificationCodeExpire,
        verificationAttempts: user.verificationAttempts || 0,
        ...(includePassword && { password: user.password }),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error) {
      throw error;
    }
  }

  async findByEmail(email, includePassword = false) {
    try {
      let query = this.Model.findOne({ email: email.toLowerCase() });
      if (includePassword) {
        query = query.select("+password");
      }
      const user = await query;
      if (!user) return null;

      return {
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        blocked: user.blocked,
        cart: user.cart,
        wishlist: user.wishlist,
        orders: user.orders,
        verificationCode: user.verificationCode,
        verificationCodeExpire: user.verificationCodeExpire,
        verificationAttempts: user.verificationAttempts || 0,
        ...(includePassword && { password: user.password }),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error) {
      throw error;
    }
  }

  async update(id, updateData) {
    try {
      const user = await this.Model.findById(id);
      if (!user) return null;

      // Handle password separately if provided
      if (updateData.password) {
        if (!validatePasswordFormat(updateData.password)) {
          throw new Error(PASSWORD_FORMAT_ERROR);
        }
        user.password = await this.hashPassword(updateData.password);
        delete updateData.password;
      }

      Object.assign(user, updateData);

      // Skip validation for specific fields that might be missing from old users
      const fieldsToValidate = Object.keys(updateData);
      const skipValidation = fieldsToValidate.every(
        (field) =>
          !["firstName", "lastName", "email", "password"].includes(field),
      );

      if (skipValidation) {
        // Only updating non-critical fields like role, so save without full validation
        await this.Model.collection.updateOne(
          { _id: user._id },
          { $set: updateData },
        );
      } else {
        await user.save();
      }

      return {
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        blocked: user.blocked,
        cart: user.cart,
        wishlist: user.wishlist,
        orders: user.orders,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error) {
      throw error;
    }
  }

  async updatePassword(id, newPassword, { skipFormatCheck = false } = {}) {
    try {
      if (!skipFormatCheck && !validatePasswordFormat(newPassword)) {
        throw new Error(PASSWORD_FORMAT_ERROR);
      }

      // Direct update: there is no pre-save hook, so hash here, and skip
      // full-document validation that older accounts may not pass.
      const result = await this.Model.updateOne(
        { _id: id },
        {
          $set: {
            password: await this.hashPassword(newPassword),
            updatedAt: new Date(),
          },
        },
      );
      return result.matchedCount > 0;
    } catch (error) {
      throw error;
    }
  }

  async clearCart(userId) {
    try {
      const user = await this.Model.findById(userId);
      if (!user) return false;

      user.cart = [];
      await user.save();
      return true;
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

  async findAll() {
    try {
      const users = await this.Model.find({});
      return users.map((user) => ({
        id: user._id.toString(),
        _id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        blocked: user.blocked,
        cart: user.cart,
        wishlist: user.wishlist,
        orders: user.orders,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }));
    } catch (error) {
      throw error;
    }
  }

}

export default new UserModel();
