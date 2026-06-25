import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";
import {
  buildEmailLayout,
  buildAdminEmailLayout,
  emailButton,
  emailDivider,
  emailGreeting,
  emailInfoBox,
  emailParagraph,
  emailSectionTitle,
  getFrontendUrl,
} from "./emailTemplates.js";

dotenv.config();

// Set SendGrid API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log("✅ SendGrid Email Service Initialized");
} else {
  console.error(
    "❌ CRITICAL: SENDGRID_API_KEY not set in environment variables",
  );
}

/**
 * Send email using SendGrid
 * @param {Object} mailOptions - Email options
 * @param {string} mailOptions.to - Recipient email
 * @param {string} mailOptions.subject - Email subject
 * @param {string} mailOptions.text - Plain text content
 * @param {string} mailOptions.html - HTML content
 * @returns {Promise<Object>} Email send result
 */
export const sendEmail = async (mailOptions) => {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error("SENDGRID_API_KEY is not set in environment variables");
    }

    const msg = {
      to: mailOptions.to,
      from: process.env.EMAIL_USER || "noreply@shamaimveeretz.com",
      subject: mailOptions.subject,
      text: mailOptions.text,
      html: mailOptions.html || mailOptions.text,
    };

    // Add replyTo if provided
    if (mailOptions.replyTo) {
      msg.replyTo = mailOptions.replyTo;
    }

    console.log("📧 Attempting to send email to:", mailOptions.to);
    const result = await sgMail.send(msg);
    console.log("✅ Email sent successfully to:", mailOptions.to);
    return {
      success: true,
      message: "Email sent successfully",
      messageId: result[0].headers["x-message-id"],
    };
  } catch (error) {
    console.error("❌ Email Send Error:", error.message);
    console.error("   Error Code:", error.code);
    console.error("   Error Details:", JSON.stringify(error, null, 2));
    return {
      success: false,
      message: error.message,
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }
};

/**
 * Send order confirmation email
 * @param {string} to - Customer email
 * @param {Object} orderData - Order details
 */
export const sendOrderConfirmation = async (to, orderData) => {
  const { orderId, items, totalPrice, customerName } = orderData;

  const itemsList = items
    .map(
      (item) =>
        `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #e8e2d6;font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;">${item.name}</td>
          <td style="padding:10px 0;border-bottom:1px solid #e8e2d6;text-align:center;font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;">${item.quantity}</td>
          <td style="padding:10px 0;border-bottom:1px solid #e8e2d6;text-align:left;font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#735c00;font-weight:600;">₪${item.price}</td>
        </tr>`,
    )
    .join("");

  const body = `
    ${emailGreeting(customerName)}
    ${emailParagraph("תודה שבחרת בשמים וארץ. ההזמנה שלך התקבלה ונכנסה לטיפול.")}
    ${emailInfoBox(
      `
      ${emailSectionTitle("פרטי הזמנה")}
      <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0 0 8px;"><strong>מספר הזמנה:</strong> ${orderId}</p>
      <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0;"><strong>סכום כולל:</strong> ₪${totalPrice}</p>
    `,
      "accent",
    )}
    ${emailSectionTitle("פריטים בהזמנה")}
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
      <tr>
        <th style="padding:8px 0;border-bottom:2px solid #d4af37;text-align:right;font-family:'Manrope',Arial,sans-serif;font-size:11px;color:#934b19;letter-spacing:1px;">מוצר</th>
        <th style="padding:8px 0;border-bottom:2px solid #d4af37;text-align:center;font-family:'Manrope',Arial,sans-serif;font-size:11px;color:#934b19;letter-spacing:1px;">כמות</th>
        <th style="padding:8px 0;border-bottom:2px solid #d4af37;text-align:left;font-family:'Manrope',Arial,sans-serif;font-size:11px;color:#934b19;letter-spacing:1px;">מחיר</th>
      </tr>
      ${itemsList}
    </table>
    ${emailParagraph('נעדכן אותך בדוא"ל כשההזמנה תצא לדרך.')}
    ${emailButton(getFrontendUrl("/shop"), "לצפייה בקולקציה")}
  `;

  return await sendEmail({
    to,
    subject: `אישור הזמנה #${orderId} — שמים וארץ`,
    html: buildEmailLayout({ body }),
  });
};

/**
 * Send order status update email
 * @param {string} to - Customer email
 * @param {Object} statusData - Status update details
 */
export const sendOrderStatusUpdate = async (to, statusData) => {
  const { orderId, status, customerName } = statusData;

  const statusMessages = {
    התקבל: "ההזמנה שלך התקבלה ונמצאת בטיפול",
    בהכנה: "ההזמנה שלך בהכנה אצלנו",
    נשלח: "ההזמנה שלך נשלחה ובדרך אליך",
    "הגיע ליעד": "ההזמנה שלך הגיעה ליעדה",
  };

  const body = `
    ${emailGreeting(customerName)}
    ${emailParagraph("יש לנו עדכון חדש לגבי ההזמנה שלך.")}
    ${emailInfoBox(
      `
      ${emailSectionTitle("סטטוס הזמנה")}
      <p style="font-family:'Noto Serif Hebrew',Georgia,serif;font-size:20px;font-weight:600;color:#735c00;margin:0 0 12px;">${statusMessages[status] || status}</p>
      <p style="font-family:'Manrope',Arial,sans-serif;font-size:13px;color:#7f7663;margin:0;">מספר הזמנה: ${orderId}</p>
    `,
      "accent",
    )}
    ${emailParagraph("תודה על הסבלנות. אנחנו כאן לכל שאלה.")}
    ${emailButton(getFrontendUrl("/shop"), "חזרה לחנות")}
  `;

  return await sendEmail({
    to,
    subject: `עדכון הזמנה #${orderId} — ${status}`,
    html: buildEmailLayout({ body }),
  });
};

/**
 * Send contact form email
 * @param {Object} contactData - Contact form data
 */
export const sendContactEmail = async (contactData) => {
  const { name, email, phone, message } = contactData;

  const body = `
    ${emailSectionTitle("פרטי הפנייה")}
    <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0 0 8px;"><strong>שם:</strong> ${name}</p>
    <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0 0 8px;"><strong>אימייל:</strong> <a href="mailto:${email}" style="color:#735c00;">${email}</a></p>
    ${phone ? `<p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0 0 8px;"><strong>טלפון:</strong> ${phone}</p>` : ""}
    ${emailDivider()}
    ${emailSectionTitle("תוכן ההודעה")}
    <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;line-height:1.7;margin:0;white-space:pre-wrap;">${message}</p>
  `;

  return await sendEmail({
    to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
    subject: `פנייה חדשה מטופס יצירת קשר — ${name}`,
    html: buildAdminEmailLayout({ title: "הודעה חדשה מטופס יצירת קשר", body }),
    replyTo: email,
  });
};

/**
 * Send welcome email to new user
 * @param {string} to - User email
 * @param {Object} userData - User data
 */
export const sendWelcomeEmail = async (to, userData) => {
  const { name } = userData;

  const body = `
    ${emailGreeting(name)}
    ${emailParagraph("שמחים שהצטרפת לשמים וארץ. מעכשיו תוכל לעקוב אחר הזמנות, לשמור מועדפים ולקבל עדכונים על קולקציות חדשות.")}
    ${emailInfoBox(`
      ${emailSectionTitle("מה מחכה לך באתר")}
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr><td style="padding:6px 0;font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;">קולקציות תכשיטי יהדות בעבודת יד</td></tr>
        <tr><td style="padding:6px 0;font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;">חוויית קנייה נוחה ומעקב הזמנות</td></tr>
        <tr><td style="padding:6px 0;font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;">עדכונים על מוצרים חדשים ומבצעים</td></tr>
      </table>
    `)}
    ${emailButton(getFrontendUrl("/shop"), "לגלות את הקולקציה")}
    ${emailParagraph("אם יש לך שאלה — אנחנו כאן בשבילך.")}
  `;

  return await sendEmail({
    to,
    subject: "ברוכים הבאים לשמים וארץ",
    html: buildEmailLayout({ body }),
  });
};

/**
 * Send new user registration notification to admin
 * @param {Object} userData - User data
 */
export const sendNewUserNotificationToAdmin = async (userData) => {
  const { name, email, phone } = userData;

  const body = `
    ${emailSectionTitle("פרטי המשתמש")}
    <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0 0 8px;"><strong>שם:</strong> ${name}</p>
    <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0 0 8px;"><strong>אימייל:</strong> <a href="mailto:${email}" style="color:#735c00;">${email}</a></p>
    ${phone ? `<p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0 0 8px;"><strong>טלפון:</strong> ${phone}</p>` : ""}
    <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0;"><strong>תאריך הרשמה:</strong> ${new Date().toLocaleString("he-IL", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
  `;

  return await sendEmail({
    to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
    subject: `משתמש חדש נרשם: ${name}`,
    html: buildAdminEmailLayout({ title: "משתמש חדש נרשם לאתר", body }),
  });
};

/**
 * Send password reset email with verification code only
 * @param {string} to - User email
 * @param {Object} resetData - Reset data with name and verificationCode
 */
export const sendPasswordResetEmail = async (to, resetData) => {
  const { name, verificationCode } = resetData;

  const body = `
    ${emailGreeting(name)}
    ${emailParagraph("קיבלנו בקשה לאיפוס הסיסמה של חשבונך. הזן את הקוד הבא בדף האימות באתר כדי להמשיך.")}
    ${emailDivider()}
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#efe7da;border:1px solid #d4af37;">
      <tr>
        <td align="center" style="padding:36px 24px;">
          <p style="font-family:'Manrope',Arial,sans-serif;font-size:10px;font-weight:600;color:#934b19;letter-spacing:3px;text-transform:uppercase;margin:0 0 20px;">קוד אימות חד-פעמי</p>
          <table border="0" cellpadding="0" cellspacing="0" align="center">
            <tr>
              <td align="center" style="background-color:#d4af37;padding:18px 44px;">
                <span style="font-family:'Courier New',Courier,monospace;font-size:38px;font-weight:700;color:#ffffff;letter-spacing:12px;">${verificationCode}</span>
              </td>
            </tr>
          </table>
          <p style="font-family:'Manrope',Arial,sans-serif;font-size:12px;color:#4d4635;margin:20px 0 0;opacity:0.8;">תקף למשך 10 דקות בלבד</p>
        </td>
      </tr>
    </table>
    ${emailInfoBox(`
      ${emailSectionTitle("שלבים לאיפוס הסיסמה")}
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr><td style="padding:5px 0;font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;">1. העתק את הקוד המופיע למעלה</td></tr>
        <tr><td style="padding:5px 0;font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;">2. חזור לדף אימות הסיסמה באתר</td></tr>
        <tr><td style="padding:5px 0;font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;">3. הזן את הקוד ולחץ על "אמת קוד"</td></tr>
        <tr><td style="padding:5px 0;font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;">4. בחר סיסמה חדשה ומאובטחת</td></tr>
      </table>
    `)}
    ${emailInfoBox(
      `
      <p style="font-family:'Manrope',Arial,sans-serif;font-size:13px;color:#554300;margin:0;line-height:1.6;">
        <strong>לא ביקשת לאפס סיסמה?</strong> התעלם מאימייל זה. חשבונך בטוח.
      </p>
    `,
      "notice",
    )}
    ${emailButton(getFrontendUrl("/verify-code"), "מעבר לדף אימות")}
  `;

  return await sendEmail({
    to,
    subject: "קוד איפוס סיסמה — שמים וארץ",
    html: buildEmailLayout({ body }),
  });
};

/**
 * Send order confirmation invoice to customer
 * @param {string} to - Customer email
 * @param {Object} orderData - Complete order details
 */
export const sendCustomerOrderInvoice = async (to, orderData) => {
  const {
    orderNumber,
    items,
    shippingAddress,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
    paymentInfo,
    createdAt,
  } = orderData;

  const itemsList = items
    .map((item) => {
      // Build options display if they exist
      let optionsHtml = "";
      if (
        item.selectedOptions &&
        Object.keys(item.selectedOptions).length > 0
      ) {
        const optionsText = Object.entries(item.selectedOptions)
          .map(([key, value]) => {
            // Translate keys to Hebrew
            const keyMap = {
              length: "אורך",
              metalType: "סוג מתכת",
              size: "מידה",
              color: "צבע",
              engraving: "חריטה",
              chain: "שרשרת",
            };
            const translatedKey = keyMap[key] || key;
            return `${translatedKey}: ${value}`;
          })
          .join(" • ");

        optionsHtml = `<div style="font-size: 13px; color: #7f8c8d; margin-top: 5px; font-style: italic;">${optionsText}</div>`;
      }

      return `
        <tr>
          <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
            <div style="font-weight: 500; color: #2c3e50;">${item.name}</div>
            ${optionsHtml}
            ${
              item.productId
                ? `<div style="font-size: 11px; color: #95a5a6; margin-top: 5px;">קוד מוצר: ${item.productId}</div>`
                : ""
            }
          </td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: center; vertical-align: top;">${
            item.quantity
          }</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: center; vertical-align: top;">₪${
            item.price
          }</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: bold; vertical-align: top;">₪${(
            item.price * item.quantity
          ).toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");

  const orderDate = createdAt
    ? new Date(createdAt).toLocaleString("he-IL", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleString("he-IL");

  const body = `
    <h2 style="font-family:'Noto Serif Hebrew',Georgia,serif;font-size:22px;font-weight:600;color:#1f1b13;margin:0 0 12px;text-align:center;">ההזמנה שלך התקבלה</h2>
    ${emailParagraph("תודה שבחרת בשמים וארץ. נעדכן אותך בכל שלב מהדרך.")}
    ${emailInfoBox(`
      ${emailSectionTitle("פרטי הזמנה")}
      <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0 0 8px;"><strong>מספר הזמנה:</strong> ${orderNumber}</p>
      <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0 0 8px;"><strong>תאריך:</strong> ${orderDate}</p>
      <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0;"><strong>סטטוס תשלום:</strong> שולם</p>
    `)}
    ${emailInfoBox(`
      ${emailSectionTitle("כתובת למשלוח")}
      <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0 0 6px;"><strong>${shippingAddress.name}</strong></p>
      <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0 0 6px;">${shippingAddress.phone}</p>
      <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0 0 6px;">${shippingAddress.street}</p>
      <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0;">${shippingAddress.city}${shippingAddress.zipCode ? `, ${shippingAddress.zipCode}` : ""} · ${shippingAddress.country || "ישראל"}</p>
    `)}
    ${emailSectionTitle("פריטים שהוזמנו")}
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <thead>
        <tr>
          <th style="padding:10px 8px;border-bottom:2px solid #d4af37;text-align:right;font-family:'Manrope',Arial,sans-serif;font-size:11px;color:#934b19;">מוצר</th>
          <th style="padding:10px 8px;border-bottom:2px solid #d4af37;text-align:center;font-family:'Manrope',Arial,sans-serif;font-size:11px;color:#934b19;">כמות</th>
          <th style="padding:10px 8px;border-bottom:2px solid #d4af37;text-align:center;font-family:'Manrope',Arial,sans-serif;font-size:11px;color:#934b19;">מחיר</th>
          <th style="padding:10px 8px;border-bottom:2px solid #d4af37;text-align:center;font-family:'Manrope',Arial,sans-serif;font-size:11px;color:#934b19;">סה"כ</th>
        </tr>
      </thead>
      <tbody>${itemsList}</tbody>
    </table>
    ${emailInfoBox(
      `
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;">סכום ביניים</td><td style="padding:6px 0;text-align:left;font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;">₪${itemsPrice}</td></tr>
        ${taxPrice > 0 ? `<tr><td style="padding:6px 0;font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;">מע"מ</td><td style="padding:6px 0;text-align:left;font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;">₪${taxPrice}</td></tr>` : ""}
        <tr><td style="padding:6px 0;font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;">משלוח</td><td style="padding:6px 0;text-align:left;font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;">₪${shippingPrice}</td></tr>
        <tr><td style="padding:12px 0 0;border-top:1px solid #d4af37;font-family:'Noto Serif Hebrew',Georgia,serif;font-size:16px;color:#735c00;"><strong>סה"כ לתשלום</strong></td><td style="padding:12px 0 0;border-top:1px solid #d4af37;text-align:left;font-family:'Noto Serif Hebrew',Georgia,serif;font-size:18px;color:#735c00;font-weight:700;">₪${totalPrice}</td></tr>
      </table>
    `,
      "accent",
    )}
    ${emailInfoBox(
      `
      <p style="font-family:'Manrope',Arial,sans-serif;font-size:13px;color:#554300;margin:0 0 8px;line-height:1.7;"><strong>מה הלאה?</strong></p>
      <p style="font-family:'Manrope',Arial,sans-serif;font-size:13px;color:#554300;margin:0;line-height:1.7;">נתחיל להכין את ההזמנה מיד · תקבל עדכון כשהיא תישלח · משלוח סטנדרטי: 3–5 ימי עסקים</p>
    `,
      "notice",
    )}
    ${emailButton(getFrontendUrl("/shop"), "חזרה לחנות")}
  `;

  return await sendEmail({
    to,
    subject: `אישור הזמנה #${orderNumber} — שמים וארץ`,
    html: buildEmailLayout({ body }),
  });
};

/**
 * Send new order notification to business owner
 * @param {Object} orderData - Complete order details
 */
export const sendBusinessOwnerOrderNotification = async (orderData) => {
  const {
    orderNumber,
    items,
    shippingAddress,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
    paymentInfo,
    createdAt,
    userId,
    customerEmail,
  } = orderData;

  const itemsList = items
    .map((item) => {
      // Build options display if they exist
      let optionsHtml = "";
      if (
        item.selectedOptions &&
        Object.keys(item.selectedOptions).length > 0
      ) {
        const optionsText = Object.entries(item.selectedOptions)
          .map(([key, value]) => {
            // Translate keys to Hebrew
            const keyMap = {
              length: "אורך",
              metalType: "סוג מתכת",
              size: "מידה",
              color: "צבע",
              engraving: "חריטה",
              chain: "שרשרת",
            };
            const translatedKey = keyMap[key] || key;
            return `${translatedKey}: ${value}`;
          })
          .join(" • ");

        optionsHtml = `<div style="font-size: 13px; color: #7f8c8d; margin-top: 5px; font-style: italic;">${optionsText}</div>`;
      }

      return `
        <tr>
          <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
            <div style="font-weight: 500; color: #2c3e50;">${item.name}</div>
            ${optionsHtml}
            ${
              item.productId
                ? `<div style="font-size: 11px; color: #95a5a6; margin-top: 5px;">קוד מוצר: ${item.productId}</div>`
                : ""
            }
          </td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: center; vertical-align: top;">${
            item.quantity
          }</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: center; vertical-align: top;">₪${
            item.price
          }</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: bold; vertical-align: top;">₪${(
            item.price * item.quantity
          ).toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");

  const orderDate = createdAt
    ? new Date(createdAt).toLocaleString("he-IL", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleString("he-IL");

  const paymentMethodLabel =
    paymentInfo?.method === "credit_card"
      ? "כרטיס אשראי"
      : paymentInfo?.method === "paypal"
        ? "PayPal"
        : paymentInfo?.method === "bit"
          ? "ביט"
          : paymentInfo?.method || "לא צוין";

  const body = `
    <p style="font-family:'Manrope',Arial,sans-serif;font-size:15px;color:#735c00;font-weight:600;margin:0 0 20px;">הזמנה #${orderNumber} · ₪${totalPrice} · ${orderDate}</p>
    ${emailInfoBox(`
      ${emailSectionTitle("פרטי לקוח")}
      <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0 0 6px;"><strong>שם:</strong> ${shippingAddress.name}</p>
      <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0 0 6px;"><strong>טלפון:</strong> <a href="tel:${shippingAddress.phone}" style="color:#735c00;">${shippingAddress.phone}</a></p>
      ${customerEmail ? `<p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0 0 6px;"><strong>אימייל:</strong> <a href="mailto:${customerEmail}" style="color:#735c00;">${customerEmail}</a></p>` : ""}
      ${userId ? `<p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0;"><strong>מזהה לקוח:</strong> ${userId}</p>` : ""}
    `)}
    ${emailInfoBox(`
      ${emailSectionTitle("כתובת למשלוח")}
      <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0 0 6px;">${shippingAddress.street}</p>
      <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0;">${shippingAddress.city}${shippingAddress.zipCode ? `, ${shippingAddress.zipCode}` : ""} · ${shippingAddress.country || "ישראל"}</p>
    `)}
    ${emailSectionTitle("פריטים בהזמנה")}
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <thead>
        <tr>
          <th style="padding:8px;border-bottom:2px solid #d4af37;text-align:right;font-size:11px;color:#934b19;">מוצר</th>
          <th style="padding:8px;border-bottom:2px solid #d4af37;text-align:center;font-size:11px;color:#934b19;">כמות</th>
          <th style="padding:8px;border-bottom:2px solid #d4af37;text-align:center;font-size:11px;color:#934b19;">מחיר</th>
          <th style="padding:8px;border-bottom:2px solid #d4af37;text-align:center;font-size:11px;color:#934b19;">סה"כ</th>
        </tr>
      </thead>
      <tbody>${itemsList}</tbody>
    </table>
    ${emailInfoBox(
      `
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:4px 0;font-size:14px;color:#4d4635;">סכום מוצרים</td><td style="padding:4px 0;text-align:left;font-size:14px;color:#4d4635;">₪${itemsPrice}</td></tr>
        ${taxPrice > 0 ? `<tr><td style="padding:4px 0;font-size:14px;color:#4d4635;">מע"מ</td><td style="padding:4px 0;text-align:left;font-size:14px;color:#4d4635;">₪${taxPrice}</td></tr>` : ""}
        <tr><td style="padding:4px 0;font-size:14px;color:#4d4635;">משלוח</td><td style="padding:4px 0;text-align:left;font-size:14px;color:#4d4635;">₪${shippingPrice}</td></tr>
        <tr><td style="padding:10px 0 0;border-top:1px solid #d4af37;font-size:15px;color:#735c00;"><strong>סה"כ</strong></td><td style="padding:10px 0 0;border-top:1px solid #d4af37;text-align:left;font-size:16px;color:#735c00;font-weight:700;">₪${totalPrice}</td></tr>
      </table>
    `,
      "accent",
    )}
    ${emailInfoBox(`
      ${emailSectionTitle("תשלום")}
      <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0 0 6px;"><strong>שיטה:</strong> ${paymentMethodLabel}</p>
      ${paymentInfo?.transactionId ? `<p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0 0 6px;"><strong>מזהה עסקה:</strong> ${paymentInfo.transactionId}</p>` : ""}
      <p style="font-family:'Manrope',Arial,sans-serif;font-size:14px;color:#4d4635;margin:0;"><strong>סטטוס:</strong> שולם</p>
    `)}
  `;

  return await sendEmail({
    to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
    subject: `הזמנה חדשה #${orderNumber} — ₪${totalPrice}`,
    html: buildAdminEmailLayout({ title: "הזמנה חדשה התקבלה", body }),
  });
};

/**
 * Send newsletter welcome email with coupon code
 * @param {string} to - Subscriber email
 * @param {string} couponCode - Generated coupon code
 */
export const sendNewsletterWelcomeEmail = async (to, couponCode) => {
  const shopUrl = getFrontendUrl("/shop");

  const body = `
    <h2 style="font-family:'Noto Serif Hebrew',Georgia,serif;font-size:22px;font-weight:600;color:#1f1b13;margin:0 0 16px;">ברוכים הבאים לניוזלטר של שמים וארץ</h2>
    ${emailParagraph('תודה שנרשמת לעדכונים שלנו. מעכשיו תקבלו חדשות על קולקציות חדשות, השראה ומבצעים מיוחדים — ישירות לתיבת הדוא"ל.')}
    ${emailParagraph("כמתנת הצטרפות, הנה קוד הנחה אישי לרכישה הראשונה שלך בחנות:")}
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#efe7da;border:1px solid #d4af37;margin-bottom:28px;">
      <tr>
        <td align="center" style="padding:32px 24px;">
          <p style="font-family:'Manrope',Arial,sans-serif;font-size:10px;font-weight:600;color:#934b19;letter-spacing:3px;text-transform:uppercase;margin:0 0 16px;">קוד הנחה בלעדי — 5% הנחה</p>
          <table border="0" cellpadding="0" cellspacing="0" align="center">
            <tr>
              <td align="center" style="background-color:#d4af37;padding:16px 40px;">
                <span style="font-family:'Courier New',Courier,monospace;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:6px;">${couponCode}</span>
              </td>
            </tr>
          </table>
          <p style="font-family:'Manrope',Arial,sans-serif;font-size:12px;color:#4d4635;margin:14px 0 0;">הזינו את הקוד בעת התשלום בחנות המקוונת</p>
        </td>
      </tr>
    </table>
    ${emailInfoBox(
      `
      <p style="font-family:'Manrope',Arial,sans-serif;font-size:13px;color:#554300;margin:0;line-height:1.6;">
        הקוד תקף לכל רכישה באתר ואינו מוגבל בזמן. נשמח לראות אתכם בין שמים לארץ — בקולקציית התכשיטים שלנו.
      </p>
    `,
      "notice",
    )}
    ${emailButton(shopUrl, "לכניסה לחנות")}
    ${emailParagraph(`או העתיקו את הקישור: <a href="${shopUrl}" style="color:#735c00;">${shopUrl}</a>`)}
  `;

  return await sendEmail({
    to,
    subject: "ברוכים הבאים לניוזלטר — קוד הנחה ממתין לכם",
    html: buildEmailLayout({ body }),
  });
};
