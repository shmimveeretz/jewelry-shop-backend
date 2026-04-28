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
              <p>הודעה זו נשלחה מטופס יצירת קשר באתר שמים וארץ</p>
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
      html: `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Hebrew:wght@400;700&family=Manrope:wght@400;600;700&display=swap" rel="stylesheet"/>
  <style>
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; }
      .content-cell { padding: 24px 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#fff8f0;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#fff8f0;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="max-width:600px;background-color:#ffffff;border:1px solid #d0c5af;">

          <!-- HEADER -->
          <tr>
            <td align="center" style="background-color:#fafaf7;border-bottom:1px solid #e8d98a;padding:32px 32px 28px;">
              <p style="margin:0 0 12px;font-size:22px;">✡</p>
              <h1 style="font-family:'Noto Serif Hebrew',Georgia,serif;font-size:26px;font-weight:700;color:#8b4513;margin:0 0 8px;letter-spacing:-0.5px;">שמים וארץ</h1>
              <p style="font-family:'Manrope',Arial,sans-serif;font-size:10px;color:#7f7663;letter-spacing:3px;text-transform:uppercase;margin:0;">תכשיטי יהדות בעבודת יד</p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:40px 48px;" class="content-cell">

              <!-- Greeting -->
              <h2 style="font-family:'Noto Serif Hebrew',Georgia,serif;font-size:20px;font-weight:700;color:#1f1b13;margin:0 0 12px;">שלום ${name},</h2>
              <p style="font-family:'Manrope',Arial,sans-serif;font-size:15px;color:#4d4635;line-height:1.8;margin:0 0 28px;">
                תודה שפנית אלינו! קיבלנו את הודעתך ונחזור אליך בהקדם האפשרי. אנו מעריכים את העניין שלך ביצירות המורשת שלנו.
              </p>

              <!-- Spiritual Divider -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:20px 0;">
                <tr>
                  <td style="border-top:1px solid #e8d98a;"></td>
                  <td style="padding:0 12px;font-size:14px;color:#d4af37;white-space:nowrap;">♦</td>
                  <td style="border-top:1px solid #e8d98a;"></td>
                </tr>
              </table>

              <!-- Message Recap Box -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#fbf3e5;border:1px solid #d0c5af;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="font-family:'Manrope',Arial,sans-serif;font-size:10px;color:#735c00;letter-spacing:2px;text-transform:uppercase;margin:0 0 16px;padding-bottom:8px;border-bottom:1px solid #d4af37;">פרטי הפנייה</p>
                    ${
                      subject
                        ? `<p style="font-family:'Manrope',Arial,sans-serif;font-size:11px;color:#7f7663;margin:0 0 4px;">נושא ההודעה</p>
                    <p style="font-family:'Manrope',Arial,sans-serif;font-size:15px;color:#1f1b13;font-weight:600;margin:0 0 20px;">${subject}</p>`
                        : ""
                    }
                    <p style="font-family:'Manrope',Arial,sans-serif;font-size:11px;color:#7f7663;margin:0 0 8px;">תוכן ההודעה</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td width="3" style="background-color:#d4af37;"></td>
                        <td style="padding-right:14px;">
                          <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;font-style:italic;line-height:1.7;margin:0;">"${message}"</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Response Time Notice -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">
                <tr>
                  <td style="background-color:#efe7da;border:1px solid #e8d98a;border-radius:50px;padding:10px 24px;text-align:center;">
                    <p style="font-family:'Manrope',Arial,sans-serif;font-size:12px;color:#1f1b13;margin:0;">⏱ זמני תגובה: עד 48 שעות בימי עבודה</p>
                  </td>
                </tr>
              </table>

              <!-- Mood Image -->
              <div style="margin-top:36px;overflow:hidden;">
                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBBYNxAuCjFGCXdLAzK3FA_JsNe3bunMMirCn9sLMTRhcJ87YMQDHnot1gjOmQi8sSJvolnmWie1WTpl8Nvd_LlczBW0sC8pmOVDEHee2HMtc433VpHk3yt_mp1Fp1Q4lNh8IoSA_TK5OjIzvb-SOKqwbKbyGMdXyseWMs450oz5Mt730PU6aBqlP47HcwkroTHnNDM_7jRCrA-U_Qi0zvW2vLtALHJmWqiOC3mRqGj2vZe0RxpZxRbwjc22QMqg8bSvQjHIXf0Ht8"
                  alt="אמנות יהודית נצחית" width="504" style="width:100%;height:auto;display:block;max-height:200px;object-fit:cover;"/>
              </div>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color:#d4af37;padding:36px 32px;text-align:center;">
              <p style="font-family:'Noto Serif Hebrew',Georgia,serif;font-size:20px;color:#554300;margin:0 0 6px;font-weight:700;">שמים וארץ</p>
              <div style="width:48px;height:1px;background-color:#9a7a00;margin:0 auto 20px;"></div>
              <p style="font-family:'Manrope',Arial,sans-serif;font-size:13px;color:#6b4e00;margin:0 0 6px;">✉ ${process.env.EMAIL_USER}</p>
              ${process.env.BUSINESS_PHONE ? `<p style="font-family:'Manrope',Arial,sans-serif;font-size:13px;color:#6b4e00;margin:0 0 6px;">📞 ${process.env.BUSINESS_PHONE}</p>` : ""}
              <div style="margin-top:28px;padding-top:16px;border-top:1px solid #b8910a;">
                <p style="font-family:'Manrope',Arial,sans-serif;font-size:10px;color:#8a6800;letter-spacing:2px;text-transform:uppercase;margin:0;">
                  © 2026 Shamaim VeEretz. Celestial and Terrestrial Heritage Jewelry.
                </p>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
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
