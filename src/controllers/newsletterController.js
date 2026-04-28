import NewsletterMongo from "../models/NewsletterMongo.js";
import CouponMongo from "../models/CouponMongo.js";
import { sendNewsletterWelcomeEmail } from "../utils/emailService.js";

// @desc    Subscribe to newsletter
// @route   POST /api/newsletter/subscribe
// @access  Public
export const subscribe = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res
        .status(400)
        .json({ success: false, message: "נא להזין כתובת אימייל תקינה" });
    }

    const existing = await NewsletterMongo.findOne({
      email: email.toLowerCase(),
    });
    if (existing) {
      return res
        .status(400)
        .json({
          success: false,
          message: "כתובת אימייל זו כבר רשומה לניוזלטר",
        });
    }

    // Generate unique coupon code: WELCOME + 4 random digits
    let couponCode;
    let attempts = 0;
    do {
      const digits = Math.floor(1000 + Math.random() * 9000);
      couponCode = `WELCOME${digits}`;
      attempts++;
    } while (
      attempts < 10 &&
      (await CouponMongo.findOne({ code: couponCode }))
    );

    // Save coupon
    await CouponMongo.create({
      code: couponCode,
      discountPercent: 5,
      type: "newsletter",
      description: `קוד ניוזלטר עבור ${email}`,
      isActive: true,
    });

    // Save subscriber
    await NewsletterMongo.create({ email: email.toLowerCase(), couponCode });

    // Send welcome email (non-blocking)
    sendNewsletterWelcomeEmail(email, couponCode).catch((err) =>
      console.error("❌ Newsletter email error:", err.message),
    );

    res.status(201).json({ success: true, couponCode });
  } catch (error) {
    console.error("❌ Newsletter Subscribe Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
