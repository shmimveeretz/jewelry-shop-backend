import CouponMongo from "../models/CouponMongo.js";

// @desc    Validate coupon code
// @route   POST /api/coupons/validate
// @access  Public
export const validateCoupon = async (req, res) => {
  try {
    const code = typeof req.body.code === "string" ? req.body.code.trim() : "";
    if (!code)
      return res
        .status(400)
        .json({ success: false, message: "נא להזין קוד קופון" });

    const coupon = await CouponMongo.findOne({
      code: code.toUpperCase().slice(0, 64),
    });

    const reason = coupon ? coupon.unavailableReason() : "missing";
    if (reason) {
      const messages = {
        expired: "תוקף הקופון פג",
        "used-up": "הקופון כבר נוצל",
      };
      return res.status(404).json({
        success: false,
        message: messages[reason] || "קוד קופון לא תקין או פג תוקף",
      });
    }

    res.json({ success: true, discountPercent: coupon.discountPercent });
  } catch (error) {
    console.error("❌ Validate Coupon Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all coupons
// @route   GET /api/coupons
// @access  Admin
export const getCoupons = async (req, res) => {
  try {
    const coupons = await CouponMongo.find().sort({ createdAt: -1 });
    res.json({ success: true, data: coupons });
  } catch (error) {
    console.error("❌ Get Coupons Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create coupon
// @route   POST /api/coupons
// @access  Admin
export const createCoupon = async (req, res) => {
  try {
    const { code, discountPercent, description, type } = req.body;

    if (typeof code !== "string" || !code.trim() || !discountPercent) {
      return res
        .status(400)
        .json({ success: false, message: "קוד ואחוז הנחה הם שדות חובה" });
    }

    const percent = Number(discountPercent);
    if (!Number.isFinite(percent) || percent < 1 || percent > 100) {
      return res
        .status(400)
        .json({ success: false, message: "אחוז ההנחה חייב להיות בין 1 ל-100" });
    }

    // Optional limits: empty means unlimited / never expires
    const maxUses = req.body.maxUses ? parseInt(req.body.maxUses, 10) : null;
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) {
      return res
        .status(400)
        .json({ success: false, message: "מספר שימושים מקסימלי לא תקין" });
    }
    const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      return res.status(400).json({ success: false, message: "תאריך תפוגה לא תקין" });
    }

    const existing = await CouponMongo.findOne({
      code: code.trim().toUpperCase(),
    });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "קוד קופון זה כבר קיים" });
    }

    const coupon = await CouponMongo.create({
      code: code.trim().toUpperCase(),
      discountPercent: percent,
      description: typeof description === "string" ? description.slice(0, 200) : "",
      type: type === "newsletter" ? "newsletter" : "manual",
      isActive: true,
      maxUses,
      expiresAt,
    });

    res.status(201).json({ success: true, data: coupon });
  } catch (error) {
    console.error("❌ Create Coupon Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete coupon
// @route   DELETE /api/coupons/:id
// @access  Admin
export const deleteCoupon = async (req, res) => {
  try {
    const coupon = await CouponMongo.findByIdAndDelete(req.params.id);
    if (!coupon)
      return res.status(404).json({ success: false, message: "קופון לא נמצא" });

    res.json({ success: true, message: "קופון נמחק בהצלחה" });
  } catch (error) {
    console.error("❌ Delete Coupon Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
