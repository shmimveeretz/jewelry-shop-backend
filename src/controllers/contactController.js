import { sendEmail } from "../utils/emailService.js";
import dotenv from "dotenv";

dotenv.config();

// Send contact form email
export const sendContactEmail = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Validation
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "אנא מלא את כל השדות הנדרשים",
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

    // Email to business owner
    const mailToOwner = {
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f8f6; border-radius: 10px;">
          <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h2 style="color: #8b4513; border-bottom: 3px solid #d4af37; padding-bottom: 10px;">הודעה חדשה מטופס יצירת קשר</h2>
            
            <div style="margin: 20px 0;">
              <p style="margin: 10px 0;"><strong style="color: #8b4513;">שם:</strong> ${name}</p>
              <p style="margin: 10px 0;"><strong style="color: #8b4513;">אימייל:</strong> <a href="mailto:${email}" style="color: #d4af37;">${email}</a></p>
              ${
                phone
                  ? `<p style="margin: 10px 0;"><strong style="color: #8b4513;">טלפון:</strong> ${phone}</p>`
                  : ""
              }
              ${
                subject
                  ? `<p style="margin: 10px 0;"><strong style="color: #8b4513;">נושא:</strong> ${subject}</p>`
                  : ""
              }
            </div>
            
            <div style="background-color: #f9f8f6; padding: 20px; border-radius: 5px; margin-top: 20px;">
              <h3 style="color: #8b4513; margin-top: 0;">תוכן ההודעה:</h3>
              <p style="white-space: pre-wrap; line-height: 1.6; color: #333;">${message}</p>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #888; font-size: 12px;">
              <p>הודעה זו נשלחה מטופס יצירת קשר באתר שמיים וארץ</p>
              <p>תאריך: ${new Date().toLocaleDateString("he-IL", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}</p>
            </div>
          </div>
        </div>
      `,
    };

    // Confirmation email to customer
    const mailToCustomer = {
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f8f6; border-radius: 10px;">
          <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h2 style="color: #8b4513; border-bottom: 3px solid #d4af37; padding-bottom: 10px;">שלום ${name},</h2>
            
            <p style="font-size: 16px; line-height: 1.8; color: #333;">
              תודה שפנית אלינו! קיבלנו את הודעתך ונחזור אליך בהקדם האפשרי.
            </p>
            
            <div style="background-color: #f9f8f6; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #8b4513; margin-top: 0;">פרטי ההודעה שנשלחה:</h3>
              ${subject ? `<p><strong>נושא:</strong> ${subject}</p>` : ""}
              <p style="white-space: pre-wrap; line-height: 1.6; color: #555;">${message}</p>
            </div>
            
            <div style="margin-top: 30px; padding: 20px; background-color: #d4af37; color: white; border-radius: 5px; text-align: center;">
              <h3 style="margin: 0 0 10px 0;">שמיים וארץ - תכשיטי יהדות בעבודת יד</h3>
              <p style="margin: 5px 0; font-size: 14px;">📧 ${
                process.env.EMAIL_USER
              }</p>
              ${
                process.env.BUSINESS_PHONE
                  ? `<p style="margin: 5px 0; font-size: 14px;">📞 ${process.env.BUSINESS_PHONE}</p>`
                  : ""
              }
            </div>
            
            <div style="margin-top: 20px; text-align: center; color: #888; font-size: 12px;">
              <p>זמני תגובה: עד 48 שעות בימי עבודה</p>
            </div>
          </div>
        </div>
      `,
    };

    // Send emails
    await sendEmail({
      to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
      subject: `הודעה חדשה מאתר שמיים וארץ: ${subject || "ללא נושא"}`,
      html: mailToOwner.html,
      replyTo: email,
    });
    await sendEmail({
      to: email,
      subject: "תודה על פניייתך - שמיים וארץ",
      html: mailToCustomer.html,
    });

    res.status(200).json({
      success: true,
      message: "ההודעה נשלחה בהצלחה! נחזור אליך בהקדם.",
    });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({
      success: false,
      message: "אירעה שגיאה בשליחת ההודעה. אנא נסה שוב מאוחר יותר.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
