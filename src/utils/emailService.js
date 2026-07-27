import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";
dotenv.config();

// Set SendGrid API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log("SendGrid Email Service Initialized");
} else {
  console.error("CRITICAL: SENDGRID_API_KEY not set in environment variables");
}

/**
 * Reusable Base Email Template
 * @param {string} contentHtml - The inner content of the email
 * @param {string} title - The title of the email
 * @returns {string} - Full HTML template
 */
const generateEmailTemplate = (contentHtml, title) => {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;700&family=Manrope:wght@300;400;600&display=swap" rel="stylesheet"/>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #faf8f5;
      font-family: 'Manrope', Arial, sans-serif;
      color: #1f1b13;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border: 1px solid #d0c5af;
    }
    .header {
      padding: 60px 40px 40px;
      background-color: #fffcf8;
      border-bottom: 1px solid #e8d8a0;
      text-align: center;
    }
    .brand-name {
      font-family: 'Noto Serif', Georgia, serif;
      font-size: 32px;
      font-weight: 700;
      color: #1f1b13;
      margin: 0 0 12px;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .brand-tagline {
      font-size: 11px;
      color: #934b19;
      letter-spacing: 4px;
      text-transform: uppercase;
      margin: 0;
      opacity: 0.8;
    }
    .body {
      padding: 50px 60px;
    }
    .h2 {
      font-family: 'Noto Serif', Georgia, serif;
      font-size: 24px;
      font-weight: 600;
      color: #1f1b13;
      margin: 0 0 20px;
    }
    .p {
      font-size: 16px;
      color: #4d4635;
      line-height: 1.8;
      margin: 0 0 32px;
    }
    .divider {
      border: none;
      border-top: 1px solid #d0c5af;
      margin: 40px 0;
    }
    .footer {
      background-color: #1f1b13;
      padding: 50px 40px;
      text-align: center;
      color: #d0c5af;
    }
    .footer-brand {
      font-family: 'Noto Serif', Georgia, serif;
      font-size: 20px;
      color: #faf8f5;
      margin: 0 0 8px;
    }
    .footer-links {
      font-size: 12px;
      color: #d0c5af;
      margin: 20px 0 0;
      opacity: 0.7;
    }
    .btn {
      display: inline-block;
      background-color: #1f1b13;
      color: #faf8f5 !important;
      padding: 16px 48px;
      text-decoration: none;
      font-weight: 600;
      letter-spacing: 1px;
      margin-top: 20px;
    }
    .table-receipt {
      width: 100%;
      border-collapse: collapse;
      margin: 30px 0;
    }
    .table-receipt th {
      text-align: right;
      font-size: 12px;
      text-transform: uppercase;
      color: #934b19;
      padding-bottom: 12px;
      border-bottom: 1px solid #e8d8a0;
    }
    .table-receipt td {
      padding: 16px 0;
      border-bottom: 1px solid #f2ede4;
      font-size: 14px;
    }
    .code-box {
      background-color: #efe7da;
      border: 1px solid #d4af37;
      padding: 40px;
      text-align: center;
      margin: 40px 0;
    }
    .code-text {
      font-family: 'Courier New', Courier, monospace;
      font-size: 32px;
      font-weight: 700;
      color: #1f1b13;
      letter-spacing: 12px;
    }
  </style>
</head>
<body>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <div class="container">
          <div class="header">
            <h1 class="brand-name">שמים וארץ</h1>
            <p class="brand-tagline">Handcrafted Jewish Jewelry</p>
          </div>
          <div class="body">
            ${contentHtml}
          </div>
          <div class="footer">
            <h3 class="footer-brand">שמים וארץ</h3>
            <p style="font-size: 11px; letter-spacing: 2px; opacity: 0.6; margin-bottom: 30px;">THE CELESTIAL GALLERY</p>
            <p style="font-size: 13px; margin-bottom: 8px;">${process.env.EMAIL_USER}</p>
            <div class="footer-links">
              © כל הזכויות שמורות לשמים וארץ. תשפ"ו.
            </div>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * Core Send Email logic
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
    if (mailOptions.replyTo) {
      msg.replyTo = mailOptions.replyTo;
    }
    const result = await sgMail.send(msg);
    return {
      success: true,
      message: "Email sent successfully",
      messageId: result[0].headers["x-message-id"],
    };
  } catch (error) {
    console.error("Email Service Error:", error.message);
    return { success: false, message: error.message };
  }
};

/**
 * Transactional Emails
 */

export const sendOrderConfirmation = async (to, orderData) => {
  const { orderId, items, totalPrice, customerName } = orderData;
  const itemsList = items
    .map(
      (item) => `
    <tr>
      <td>${item.name}</td>
      <td style="text-align:center;">${item.quantity}</td>
      <td style="text-align:left;">₪${item.price}</td>
    </tr>
  `,
    )
    .join("");

  const contentHtml = `
    <h2 class="h2">אישור הזמנה</h2>
    <p class="p">שלום ${customerName}, תודה שבחרת בשמים וארץ. הזמנתך התקבלה ומעובדת כעת בגלריה שלנו.</p>
    <table class="table-receipt">
      <thead>
        <tr>
          <th>פריט</th>
          <th style="text-align:center;">כמות</th>
          <th style="text-align:left;">מחיר</th>
        </tr>
      </thead>
      <tbody>${itemsList}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding-top:24px; font-weight:600; border:none;">סה"כ לתשלום</td>
          <td style="padding-top:24px; font-weight:700; text-align:left; font-size:18px; border:none; color:#934b19;">₪${totalPrice}</td>
        </tr>
      </tfoot>
    </table>
    <div style="text-align:center;">
      <a href="${process.env.FRONTEND_URL}/track-order?orderId=${orderId}" class="btn">מעקב אחר הזמנה</a>
    </div>
  `;

  return await sendEmail({
    to,
    subject: `אישור הזמנה #${orderId} - שמים וארץ`,
    html: generateEmailTemplate(contentHtml, "אישור הזמנה"),
  });
};

/**
 * Customer thank-you email with tracking number (sent after successful payment)
 * orderData: { orderNumber, items, shippingAddress, itemsPrice, shippingPrice, totalPrice, paymentInfo, createdAt }
 */
export const sendCustomerOrderInvoice = async (to, orderData) => {
  const {
    orderNumber,
    items = [],
    shippingAddress = {},
    shippingPrice,
    totalPrice,
  } = orderData;

  const frontendBase = (
    process.env.FRONTEND_URL || "https://shamaimveeretz.com"
  ).replace(/\/{2,}$/, "");
  const trackUrl = `${frontendBase}/track-order?orderId=${encodeURIComponent(String(orderNumber))}`;

  const itemsList = items
    .map(
      (item) => `
    <tr>
      <td>${item.name}</td>
      <td style="text-align:center;">${item.quantity ?? 1}</td>
      <td style="text-align:left;">₪${item.price}</td>
    </tr>
  `,
    )
    .join("");

  const addressLine = [
    shippingAddress.name,
    shippingAddress.street,
    shippingAddress.city,
    shippingAddress.zipCode,
  ]
    .filter(Boolean)
    .join(", ");

  const contentHtml = `
    <h2 class="h2">תודה על ההזמנה!</h2>
    <p class="p">הזמנתך התקבלה בהצלחה ומעובדת כעת בגלריה שלנו. שמור את מספר המעקב לבדיקת סטטוס ההזמנה בכל עת.</p>
    <div class="code-box">
      <p style="font-size:10px; font-weight:600; color:#934b19; letter-spacing:3px; text-transform:uppercase; margin:0 0 24px;">מספר מעקב</p>
      <span class="code-text" style="font-size:20px; letter-spacing:2px;">${orderNumber}</span>
    </div>
    <table class="table-receipt">
      <thead>
        <tr>
          <th>פריט</th>
          <th style="text-align:center;">כמות</th>
          <th style="text-align:left;">מחיר</th>
        </tr>
      </thead>
      <tbody>${itemsList}</tbody>
      <tfoot>
        ${
          shippingPrice != null
            ? `<tr>
          <td colspan="2" style="border:none; padding-top:16px;">משלוח</td>
          <td style="border:none; padding-top:16px; text-align:left;">₪${shippingPrice}</td>
        </tr>`
            : ""
        }
        <tr>
          <td colspan="2" style="padding-top:24px; font-weight:600; border:none;">סה"כ שולם</td>
          <td style="padding-top:24px; font-weight:700; text-align:left; font-size:18px; border:none; color:#934b19;">₪${totalPrice}</td>
        </tr>
      </tfoot>
    </table>
    ${
      addressLine
        ? `<div style="background-color:#fffcf8; border:1px solid #e8d8a0; padding:25px; margin:30px 0;">
      <h4 style="margin:0 0 10px; font-size:12px; text-transform:uppercase; color:#934b19;">כתובת למשלוח</h4>
      <p style="margin:0; line-height:1.6;">${addressLine}</p>
    </div>`
        : ""
    }
    <p class="p" style="margin-bottom:0;">משלוח סטנדרטי לוקח 3-5 ימי עסקים. נעדכן אותך בכל שלב.</p>
    <div style="text-align:center;">
      <a href="${trackUrl}" class="btn">מעקב אחר ההזמנה</a>
    </div>
  `;

  return await sendEmail({
    to,
    subject: `תודה על ההזמנה! מספר מעקב #${orderNumber} - שמים וארץ`,
    html: generateEmailTemplate(contentHtml, "אישור הזמנה"),
  });
};

/**
 * New-order notification to the business owner / admin
 */
export const sendBusinessOwnerOrderNotification = async (orderData) => {
  const {
    orderNumber,
    items = [],
    shippingAddress = {},
    totalPrice,
    paymentInfo = {},
    customerEmail,
    userId,
  } = orderData;

  const itemsList = items
    .map(
      (item) => `
    <tr>
      <td>${item.name}</td>
      <td style="text-align:center;">${item.quantity ?? 1}</td>
      <td style="text-align:left;">₪${item.price}</td>
    </tr>
  `,
    )
    .join("");

  const contentHtml = `
    <h2 class="h2">התקבלה הזמנה חדשה</h2>
    <div style="background-color:#fffcf8; border:1px solid #e8d8a0; padding:25px; margin-bottom:30px;">
      <p style="margin:0 0 10px;"><strong>מספר הזמנה:</strong> ${orderNumber}</p>
      ${customerEmail ? `<p style="margin:0 0 10px;"><strong>אימייל לקוח:</strong> ${customerEmail}</p>` : ""}
      ${shippingAddress.name ? `<p style="margin:0 0 10px;"><strong>שם:</strong> ${shippingAddress.name}</p>` : ""}
      ${shippingAddress.phone ? `<p style="margin:0 0 10px;"><strong>טלפון:</strong> ${shippingAddress.phone}</p>` : ""}
      <p style="margin:0 0 10px;"><strong>כתובת:</strong> ${
        [shippingAddress.street, shippingAddress.city, shippingAddress.zipCode]
          .filter(Boolean)
          .join(", ") || "לא צוינה"
      }</p>
      ${paymentInfo.transactionId ? `<p style="margin:0 0 10px;"><strong>מזהה עסקה:</strong> ${paymentInfo.transactionId}</p>` : ""}
      <p style="margin:0;"><strong>סוג לקוח:</strong> ${userId && userId !== "guest" ? "משתמש רשום" : "אורח"}</p>
    </div>
    <table class="table-receipt">
      <thead>
        <tr>
          <th>פריט</th>
          <th style="text-align:center;">כמות</th>
          <th style="text-align:left;">מחיר</th>
        </tr>
      </thead>
      <tbody>${itemsList}</tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding-top:24px; font-weight:600; border:none;">סה"כ</td>
          <td style="padding-top:24px; font-weight:700; text-align:left; font-size:18px; border:none; color:#934b19;">₪${totalPrice}</td>
        </tr>
      </tfoot>
    </table>
  `;

  return await sendEmail({
    to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
    subject: `הזמנה חדשה #${orderNumber} - ₪${totalPrice}`,
    html: generateEmailTemplate(contentHtml, "הזמנה חדשה"),
  });
};

export const sendOrderStatusUpdate = async (to, statusData) => {
  const { orderId, status, customerName, trackingNumber } = statusData;
  const statusMessages = {
    // DB enum statuses (English)
    Pending: "ההזמנה התקבלה וממתינה לאישור",
    Paid: "התשלום התקבל וההזמנה מעובדת",
    Processing: "ההזמנה נמצאת בשלבי הכנה",
    Shipped: "ההזמנה נשלחה ובדרכה אליך",
    Delivered: "ההזמנה הגיעה ליעדה",
    Cancelled: "ההזמנה בוטלה",
    // Legacy Hebrew statuses
    התקבל: "ההזמנה התקבלה ומעובדת",
    בהכנה: "ההזמנה נמצאת בשלבי הכנה",
    נשלח: "ההזמנה נשלחה ובדרכה אליך",
    "הגיע ליעד": "ההזמנה הגיעה ליעדה",
  };

  const contentHtml = `
    <h2 class="h2">עדכון סטטוס הזמנה</h2>
    <p class="p">שלום ${customerName}, רצינו לעדכן אותך בנוגע להתקדמות ההזמנה שלך.</p>
    <div style="background-color:#fffcf8; border-right:4px solid #d4af37; padding:30px; margin:40px 0;">
      <p style="font-size:12px; color:#934b19; letter-spacing:2px; text-transform:uppercase; margin:0 0 12px;">סטטוס נוכחי</p>
      <p style="font-family:'Noto Serif', serif; font-size:22px; font-weight:600; margin:0;">${statusMessages[status] || status}</p>
      <p style="font-size:14px; color:#7f8c8d; margin-top:12px;">מספר הזמנה: ${orderId}</p>
      ${
        trackingNumber
          ? `<p style="font-size:14px; color:#7f8c8d; margin-top:6px;">מספר מעקב למשלוח: <span style="direction:ltr; unicode-bidi:embed; font-weight:600; color:#2c3e50;">${trackingNumber}</span></p>`
          : ""
      }
    </div>
    <div style="text-align:center;">
      <a href="${process.env.FRONTEND_URL}/track-order?orderId=${orderId}" class="btn">מעקב מהיר אחר ההזמנה</a>
    </div>
  `;

  return await sendEmail({
    to,
    subject: `עדכון לגבי הזמנה #${orderId} - שמים וארץ`,
    html: generateEmailTemplate(contentHtml, "עדכון הזמנה"),
  });
};

/**
 * Sent when the admin sets/updates the shipment tracking number.
 * Gives the customer the tracking number + a one-click order tracking button.
 */
export const sendOrderTrackingUpdate = async (to, trackingData) => {
  const { orderId, customerName, trackingNumber } = trackingData;

  const contentHtml = `
    <h2 class="h2">החבילה שלך בדרך אליך</h2>
    <p class="p">שלום ${customerName || "לקוח יקר"}, ההזמנה שלך נמסרה לחברת המשלוחים. ניתן לעקוב אחריה באמצעות מספר המעקב הבא:</p>
    <div class="code-box">
      <p style="font-size:10px; font-weight:600; color:#934b19; letter-spacing:3px; text-transform:uppercase; margin:0 0 24px;">מספר מעקב למשלוח</p>
      <span class="code-text" style="letter-spacing:3px; font-size:26px; direction:ltr; unicode-bidi:embed;">${trackingNumber}</span>
      <p style="font-size:13px; color:#4d4635; margin-top:24px; opacity:0.8;">מספר הזמנה: ${orderId}</p>
    </div>
    <div style="text-align:center;">
      <a href="${process.env.FRONTEND_URL}/track-order?orderId=${orderId}" class="btn">מעקב מהיר אחר ההזמנה</a>
    </div>
    <p class="p" style="font-size:14px; opacity:0.7; margin-top:28px; text-align:center;">בלחיצה על הכפתור תועברו לדף מעקב ההזמנה באתר — ללא צורך בהתחברות.</p>
  `;

  return await sendEmail({
    to,
    subject: `ההזמנה שלך נשלחה - מספר מעקב #${orderId} - שמים וארץ`,
    html: generateEmailTemplate(contentHtml, "מספר מעקב למשלוח"),
  });
};

export const sendPasswordResetEmail = async (to, resetData) => {
  const { name, verificationCode } = resetData;
  const contentHtml = `
    <h2 class="h2">איפוס סיסמה</h2>
    <p class="p">שלום ${name}, התקבלה בקשה לאיפוס סיסמה עבור חשבונך. השתמש בקוד האימות הבא כדי להמשיך.</p>
    <div class="code-box">
      <p style="font-size:10px; font-weight:600; color:#934b19; letter-spacing:3px; text-transform:uppercase; margin:0 0 24px;">קוד אימות חד-פעמי</p>
      <span class="code-text">${verificationCode}</span>
      <p style="font-size:13px; color:#4d4635; margin-top:24px; opacity:0.8;">הקוד תקף ל-10 דקות בלבד</p>
    </div>
    <p class="p" style="font-size:14px; opacity:0.7;">אם לא ביקשת פעולה זו, ניתן להתעלם מהודעה זו בבטחה.</p>
  `;

  return await sendEmail({
    to,
    subject: "קוד אימות לאיפוס סיסמה - שמים וארץ",
    html: generateEmailTemplate(contentHtml, "איפוס סיסמה"),
  });
};

export const sendNewsletterWelcomeEmail = async (to, couponCode) => {
  const contentHtml = `
    <h2 class="h2">ברוכים הבאים לגלריה</h2>
    <p class="p">תודה שהצטרפת לקהילת שמים וארץ. אנו נרגשים לשתף איתך יצירות חדשות וסיפורים מאחורי הקלעים.</p>
    <p class="p">כמחווה של הערכה, מצורפת הטבת הצטרפות בלעדית לרכישתך הבאה:</p>
    <div class="code-box">
      <p style="font-size:10px; font-weight:600; color:#934b19; letter-spacing:3px; text-transform:uppercase; margin:0 0 24px;">הטבת הצטרפות</p>
      <span class="code-text">${couponCode}</span>
      <p style="font-size:14px; color:#4d4635; margin-top:24px;">5% הנחה על כל הקולקציות</p>
    </div>
    <div style="text-align:center;">
      <a href="${process.env.FRONTEND_URL}/shop" class="btn">גלה את הקולקציה</a>
    </div>
  `;

  return await sendEmail({
    to,
    subject: "ברוכים הבאים לשמים וארץ",
    html: generateEmailTemplate(contentHtml, "ברוכים הבאים"),
  });
};

export const sendWelcomeEmail = async (to, userData) => {
  const { name } = userData;
  const contentHtml = `
    <h2 class="h2">ברוכים הבאים למשפחה</h2>
    <p class="p">שלום ${name}, אנו שמחים שהצטרפת אלינו. חשבונך נוצר בהצלחה וכעת תוכל לנהל את הזמנותיך ולעקוב אחר הפריטים שבחרת.</p>
    <div style="background-color:#fffcf8; border:1px solid #e8d8a0; padding:30px; margin:40px 0;">
      <h3 style="font-family:'Noto Serif', serif; font-size:18px; margin-top:0; margin-bottom:15px;">החשבון האישי שלך מאפשר:</h3>
      <ul style="line-height:2; color:#4d4635; padding-right:20px;">
        <li>ניהול כתובות ושיטות תשלום</li>
        <li>מעקב אחר היסטוריית הזמנות</li>
        <li>גישה מוקדמת לקולקציות מיוחדות</li>
      </ul>
    </div>
    <div style="text-align:center;">
      <a href="${process.env.FRONTEND_URL}/login" class="btn">כניסה לחשבון שלי</a>
    </div>
  `;

  return await sendEmail({
    to,
    subject: "חשבונך נוצר בהצלחה - שמים וארץ",
    html: generateEmailTemplate(contentHtml, "הרשמה הושלמה"),
  });
};

export const sendContactEmail = async (contactData) => {
  const { name, email, phone, message } = contactData;
  const contentHtml = `
    <h2 class="h2">פנייה חדשה מהאתר</h2>
    <div style="background-color:#fffcf8; border:1px solid #e8d8a0; padding:25px; margin-bottom:30px;">
      <p style="margin:0 0 10px;"><strong>שם:</strong> ${name}</p>
      <p style="margin:0 0 10px;"><strong>אימייל:</strong> ${email}</p>
      ${phone ? `<p style="margin:0;"><strong>טלפון:</strong> ${phone}</p>` : ""}
    </div>
    <div style="background-color:#fcfcfc; border-right:3px solid #1f1b13; padding:25px;">
      <h4 style="margin:0 0 10px; font-size:12px; text-transform:uppercase; color:#934b19;">תוכן ההודעה</h4>
      <p style="margin:0; line-height:1.6;">${message}</p>
    </div>
  `;

  return await sendEmail({
    to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
    subject: `פנייה חדשה מ-${name}`,
    html: generateEmailTemplate(contentHtml, "פנייה חדשה"),
    replyTo: email,
  });
};

export const sendNewUserNotificationToAdmin = async (userData) => {
  const { name, email, phone } = userData;
  const contentHtml = `
    <h2 class="h2">רישום משתמש חדש</h2>
    <div style="background-color:#fffcf8; border:1px solid #e8d8a0; padding:25px;">
      <p style="margin:0 0 10px;"><strong>שם:</strong> ${name}</p>
      <p style="margin:0 0 10px;"><strong>אימייל:</strong> ${email}</p>
      ${phone ? `<p style="margin:0;"><strong>טלפון:</strong> ${phone}</p>` : ""}
      <p style="margin:15px 0 0; font-size:12px; color:#7f8c8d;">תאריך הצטרפות: ${new Date().toLocaleDateString("he-IL")}</p>
    </div>
  `;

  return await sendEmail({
    to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
    subject: `משתמש חדש נרשם: ${name}`,
    html: generateEmailTemplate(contentHtml, "דיווח מערכת"),
  });
};
