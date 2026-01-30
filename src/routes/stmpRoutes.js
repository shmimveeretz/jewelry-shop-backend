import express from "express";
import { sendContactEmail } from "../utils/emailService.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// @desc    Send contact form email
// @route   POST /api/smtp/contact
// @access  Public
router.post("/contact", async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    // Validation
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "נא למלא את כל השדות הנדרשים",
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "כתובת אימייל לא תקינה",
      });
    }

    await sendContactEmail({ name, email, phone, message });

    res.json({
      success: true,
      message: "ההודעה נשלחה בהצלחה! נחזור אליך בהקדם.",
    });
  } catch (error) {
    console.error("Contact email error:", error);
    res.status(500).json({
      success: false,
      message: "שגיאה בשליחת ההודעה. נסה שוב מאוחר יותר.",
    });
  }
});

// @desc    Test SMTP connection
// @route   GET /api/smtp/test
// @access  Private (Admin)
router.get("/test", protect, async (req, res) => {
  try {
    const { sendEmail } = await import("../utils/emailService.js");

    await sendEmail({
      to: req.user.email,
      subject: "בדיקת SMTP - שמיים וארץ",
      html: `
                <div dir="rtl" style="font-family: Arial, sans-serif;">
                    <h2>✅ בדיקת SMTP הצליחה!</h2>
                    <p>שרת האימייל פועל כראוי.</p>
                    <p>זמן: ${new Date().toLocaleString("he-IL")}</p>
                </div>
            `,
    });

    res.json({
      success: true,
      message: "אימייל נשלח בהצלחה",
      recipient: req.user.email,
    });
  } catch (error) {
    console.error("SMTP test error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
