import NewsletterMongo from "../models/NewsletterMongo.js";
import CouponMongo from "../models/CouponMongo.js";
import UserMongo from "../models/UserMongo.js";
import {
  sendNewsletterWelcomeEmail,
  sendEmail,
} from "../utils/emailService.js";

// @desc    Get all newsletter subscribers
// @route   GET /api/newsletter/subscribers
// @access  Private/Admin
export const getSubscribers = async (req, res) => {
  try {
    const subscribers = await NewsletterMongo.find({}).sort({
      subscribedAt: -1,
    });
    res.json({
      success: true,
      data: subscribers,
      total: subscribers.length,
    });
  } catch (error) {
    console.error("❌ Get Subscribers Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

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
      return res.status(400).json({
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

// @desc    Toggle a registered user's newsletter subscription
// @route   PUT /api/newsletter/toggle/:userId
// @access  Private/Admin
export const toggleSubscription = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await UserMongo.findById(userId).select(
      "firstName lastName email isSubscribedToNewsletter",
    );
    if (!user) {
      return res.status(404).json({ success: false, message: "משתמש לא נמצא" });
    }

    user.isSubscribedToNewsletter = !user.isSubscribedToNewsletter;
    user.updatedAt = Date.now();
    await user.save();

    console.log(
      `📧 User ${user.email} newsletter: ${user.isSubscribedToNewsletter ? "subscribed" : "unsubscribed"}`,
    );

    res.json({
      success: true,
      message: user.isSubscribedToNewsletter
        ? "המשתמש הרשם לניוזלטר בהצלחה"
        : "המשתמש הוסר מהניוזלטר בהצלחה",
      data: {
        userId,
        email: user.email,
        isSubscribedToNewsletter: user.isSubscribedToNewsletter,
      },
    });
  } catch (error) {
    console.error("❌ Toggle Subscription Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Send bulk email to all newsletter subscribers
// @route   POST /api/newsletter/send
// @access  Private/Admin
export const toggleSubscriber = async (req, res) => {
  try {
    const { id } = req.params;
    const { subscribed } = req.body;

    const subscriber = await NewsletterMongo.findById(id);
    if (!subscriber) {
      return res
        .status(404)
        .json({ success: false, message: "מנוי לא נמצא" });
    }

    subscriber.active =
      typeof subscribed === "boolean" ? subscribed : !subscriber.active;
    await subscriber.save();

    res.json({
      success: true,
      message: subscriber.active ? "המנוי הופעל" : "המנוי הושהה",
      data: subscriber,
    });
  } catch (error) {
    console.error("❌ Toggle Subscriber Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteSubscriber = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await NewsletterMongo.findByIdAndDelete(id);

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "מנוי לא נמצא" });
    }

    res.json({ success: true, message: "המנוי נמחק בהצלחה" });
  } catch (error) {
    console.error("❌ Delete Subscriber Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendBulkEmail = async (req, res) => {
  try {
    const { subject, htmlContent, content } = req.body;
    const rawContent = htmlContent || content;
    const bodyContent =
      rawContent && rawContent.includes("<")
        ? rawContent
        : `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.6">${String(rawContent || "").replace(/\n/g, "<br>")}</div>`;

    if (!subject || !rawContent) {
      return res.status(400).json({
        success: false,
        message: "subject ותוכן ההודעה הם שדות חובה",
      });
    }

    // Collect emails from both sources:
    // 1. Email-only subscribers (NewsletterMongo)
    // 2. Registered users who opted in (UserMongo)
    const [newsletterDocs, subscribedUsers] = await Promise.all([
      NewsletterMongo.find({ active: { $ne: false } }).select("email"),
      UserMongo.find({ isSubscribedToNewsletter: true, blocked: false }).select(
        "email",
      ),
    ]);

    // Deduplicate across both sources
    const emailSet = new Set([
      ...newsletterDocs.map((d) => d.email.toLowerCase()),
      ...subscribedUsers.map((u) => u.email.toLowerCase()),
    ]);
    const recipients = [...emailSet];

    if (recipients.length === 0) {
      return res.json({
        success: true,
        message: "אין מנויים לשליחה",
        sent: 0,
        failed: 0,
      });
    }

    console.log(`📨 Sending bulk email to ${recipients.length} subscribers`);

    const results = { sent: 0, failed: 0, errors: [] };

    // Send one by one — one failure must not crash the rest
    for (const email of recipients) {
      const result = await sendEmail({ to: email, subject, html: bodyContent });
      if (result.success) {
        results.sent++;
      } else {
        results.failed++;
        results.errors.push({ email, error: result.message });
        console.error(`❌ Failed to send to ${email}:`, result.message);
      }
    }

    console.log(
      `✅ Bulk email done — sent: ${results.sent}, failed: ${results.failed}`,
    );

    res.json({
      success: true,
      message: `נשלח ל-${results.sent} מנויים${results.failed > 0 ? `, ${results.failed} נכשלו` : ""}`,
      sent: results.sent,
      failed: results.failed,
      ...(results.errors.length > 0 && { errors: results.errors }),
    });
  } catch (error) {
    console.error("❌ Send Bulk Email Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
