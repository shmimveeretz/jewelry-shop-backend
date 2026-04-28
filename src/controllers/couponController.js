import CouponMongo from "../models/CouponMongo.js";

// @desc    Validate coupon code
// @route   POST /api/coupons/validate
// @access  Public
export const validateCoupon = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code)
      return res
        .status(400)
        .json({ success: false, message: "נא להזין קוד קופון" });

    const coupon = await CouponMongo.findOne({
      code: code.trim().toUpperCase(),
      isActive: true,
    });

    if (!coupon) {
      return res
        .status(404)
        .json({ success: false, message: "קוד קופון לא תקין או פג תוקף" });
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

    if (!code || !discountPercent) {
      return res
        .status(400)
        .json({ success: false, message: "קוד ואחוז הנחה הם שדות חובה" });
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
      discountPercent,
      description: description || "",
      type: type || "manual",
      isActive: true,
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
