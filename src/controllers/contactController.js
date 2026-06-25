import { sendEmail } from "../utils/emailService.js";
import { buildAdminEmailLayout, buildEmailLayout, emailButton, emailDivider, emailGreeting, emailInfoBox, emailParagraph, emailSectionTitle, getFrontendUrl } from "../utils/emailTemplates.js";
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
      html: buildAdminEmailLayout({
        title: "הודעה חדשה מטופס יצירת קשר",
        body: `
          ${emailSectionTitle("פרטי הפנייה")}
          <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0 0 8px;"><strong>שם:</strong> ${name}</p>
          <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0 0 8px;"><strong>אימייל:</strong> <a href="mailto:${email}" style="color:#735c00;">${email}</a></p>
          ${phone ? `<p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0 0 8px;"><strong>טלפון:</strong> ${phone}</p>` : ""}
          ${subject ? `<p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0 0 8px;"><strong>נושא:</strong> ${subject}</p>` : ""}
          ${emailDivider()}
          ${emailSectionTitle("תוכן ההודעה")}
          <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;line-height:1.7;margin:0;white-space:pre-wrap;">${message}</p>
        `,
      }),
    };

    // Confirmation email to customer
    const mailToCustomer = {
      html: buildEmailLayout({
        body: `
          ${emailGreeting(name)}
          ${emailParagraph("תודה שפנית אלינו. קיבלנו את הודעתך ונחזור אליך בהקדם האפשרי.")}
          ${emailDivider()}
          ${emailInfoBox(`
            ${emailSectionTitle("פרטי הפנייה")}
            ${subject ? `<p style="font-family:'Manrope',Arial,sans-serif;font-size:11px;color:#7f7663;margin:0 0 4px;">נושא</p><p style="font-family:'Manrope',Arial,sans-serif;font-size:15px;color:#1f1b13;font-weight:600;margin:0 0 16px;">${subject}</p>` : ""}
            <p style="font-family:'Manrope',Arial,sans-serif;font-size:11px;color:#7f7663;margin:0 0 8px;">תוכן ההודעה</p>
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td width="3" style="background-color:#d4af37;"></td>
                <td style="padding-right:14px;">
                  <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;font-style:italic;line-height:1.7;margin:0;">"${message}"</p>
                </td>
              </tr>
            </table>
          `)}
          <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin:24px auto;">
            <tr>
              <td style="background-color:#efe7da;border:1px solid #e8d98a;border-radius:50px;padding:10px 24px;text-align:center;">
                <p style="font-family:'Manrope',Arial,sans-serif;font-size:12px;color:#1f1b13;margin:0;">זמני תגובה: עד 48 שעות בימי עבודה</p>
              </td>
            </tr>
          </table>
          ${emailButton(getFrontendUrl("/shop"), "לצפייה בקולקציה")}
        `,
      }),
    };

    // Send emails
    const ownerResult = await sendEmail({
      to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
      subject: `הודעה חדשה מאתר שמים וארץ: ${subject || "ללא נושא"}`,
      html: mailToOwner.html,
      replyTo: email,
    });

    if (!ownerResult.success) {
      console.error("❌ Failed to send email to owner:", ownerResult.error);
      return res.status(500).json({
        success: false,
        message: "אירעה שגיאה בשליחת ההודעה. אנא נסה שוב מאוחר יותר.",
        error:
          process.env.NODE_ENV === "development"
            ? ownerResult.error
            : undefined,
      });
    }

    await sendEmail({
      to: email,
      subject: "תודה על פניייתך - שמים וארץ",
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
