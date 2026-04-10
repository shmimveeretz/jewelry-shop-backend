import express from "express";
import { sendWelcomeEmail } from "../utils/emailService.js";

const router = express.Router();

// @desc    Send welcome email to newly registered user
// @route   POST /api/email/welcome
// @access  Public
router.post("/welcome", async (req, res) => {
  try {
    const { email, firstName, lastName } = req.body;

    if (!email || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: "email, firstName ו-lastName הם שדות חובה",
      });
    }

    const result = await sendWelcomeEmail(email, {
      name: `${firstName} ${lastName}`,
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.message || "שגיאה בשליחת המייל",
      });
    }

    res.json({
      success: true,
      message: "Welcome email sent",
    });
  } catch (error) {
    console.error("❌ Welcome email error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
